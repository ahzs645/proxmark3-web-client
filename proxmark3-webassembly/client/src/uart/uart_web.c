//-----------------------------------------------------------------------------
// Copyright (C) Proxmark3 contributors. See AUTHORS.md for details.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// See LICENSE.txt for the text of the license.
//-----------------------------------------------------------------------------
// WebSerial UART implementation for Emscripten/WASM
// Uses SPSC Ring Buffers in Shared Memory (Lock-Free)
//-----------------------------------------------------------------------------

#ifdef __EMSCRIPTEN__

#include "comms.h"
#include "uart.h"
#include <emscripten.h>
#include <emscripten/threading.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Ring Buffer Configuration
#define UART_RB_CAPACITY 65536u // 64KB buffer

typedef struct {
  _Atomic uint32_t head;        // producer writes, consumer reads
  _Atomic uint32_t tail;        // consumer writes, producer reads
  _Atomic uint32_t initialized; // set to 1 when ready
  uint8_t data[UART_RB_CAPACITY];
} uart_ringbuf_t;

// Shared Ring Buffers
// RX: Main Thread (Producer) -> Worker (Consumer)
// TX: Worker (Producer) -> Main Thread (Consumer)
static uart_ringbuf_t g_uart_rx;
static uart_ringbuf_t g_uart_tx;
uart_ringbuf_t g_uart_stdin; // New stdin ring buffer

// Timeout value in ms
static uint32_t timeout_value = 30;

// ---------- Core Ring Buffer Helpers ----------

static size_t rb_read(uart_ringbuf_t *rb, uint8_t *dst, size_t maxlen) {
  uint32_t head = atomic_load_explicit(&rb->head, memory_order_acquire);
  uint32_t tail = atomic_load_explicit(&rb->tail, memory_order_relaxed);
  uint32_t available = head - tail; // unsigned wrap-safe

  if (available == 0) {
    return 0;
  }
  if (maxlen > available) {
    maxlen = available;
  }

  uint32_t cap = UART_RB_CAPACITY;
  uint32_t tail_idx = tail % cap;

  size_t first = cap - tail_idx;
  if (first > maxlen) {
    first = maxlen;
  }

  memcpy(dst, &rb->data[tail_idx], first);

  size_t remaining = maxlen - first;
  if (remaining > 0) {
    memcpy(dst + first, &rb->data[0], remaining);
  }

  uint32_t new_tail = tail + (uint32_t)maxlen;
  atomic_store_explicit(&rb->tail, new_tail, memory_order_release);

  // Debug print for RX (assuming rb is g_uart_rx)
  if (rb == &g_uart_rx && maxlen > 0) {
    // printf("rb_read: read %zu bytes, head=%u, tail=%u\n", maxlen, head,
    // tail);
  }

  return maxlen;
}

static size_t rb_write(uart_ringbuf_t *rb, const uint8_t *src, size_t len) {
  uint32_t head = atomic_load_explicit(&rb->head, memory_order_relaxed);
  uint32_t tail = atomic_load_explicit(&rb->tail, memory_order_acquire);
  uint32_t used = head - tail;
  uint32_t cap = UART_RB_CAPACITY;
  uint32_t free = cap - used;

  if (free == 0) {
    return 0; // Buffer full
  }
  if (len > free) {
    len = free;
  }

  uint32_t head_idx = head % cap;

  size_t first = cap - head_idx;
  if (first > len) {
    first = len;
  }

  memcpy(&rb->data[head_idx], src, first);

  size_t remaining = len - first;
  if (remaining > 0) {
    memcpy(&rb->data[0], src + first, remaining);
  }

  uint32_t new_head = head + (uint32_t)len;
  atomic_store_explicit(&rb->head, new_head, memory_order_release);
  return len;
}

// ---------- Exported Pointers for JS ----------

int uart_read_stdin(void);

uintptr_t pm3_uart_rx_head_ptr(void);
uintptr_t pm3_uart_rx_tail_ptr(void);
uintptr_t pm3_uart_rx_buf_ptr(void);
uintptr_t pm3_uart_tx_head_ptr(void);
uintptr_t pm3_uart_tx_tail_ptr(void);
uintptr_t pm3_uart_tx_buf_ptr(void);
uint32_t pm3_uart_rb_capacity(void);

uintptr_t pm3_uart_stdin_head_ptr(void);
uintptr_t pm3_uart_stdin_tail_ptr(void);
uintptr_t pm3_uart_stdin_buf_ptr(void);

uintptr_t pm3_uart_rx_initialized_ptr(void);

EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_rx_head_ptr(void) {
  return (uintptr_t)&g_uart_rx.head;
}
EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_rx_tail_ptr(void) {
  return (uintptr_t)&g_uart_rx.tail;
}
EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_rx_buf_ptr(void) {
  return (uintptr_t)&g_uart_rx.data[0];
}
EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_rx_initialized_ptr(void) {
  return (uintptr_t)&g_uart_rx.initialized;
}

EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_tx_head_ptr(void) {
  return (uintptr_t)&g_uart_tx.head;
}
EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_tx_tail_ptr(void) {
  return (uintptr_t)&g_uart_tx.tail;
}
EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_tx_buf_ptr(void) {
  return (uintptr_t)&g_uart_tx.data[0];
}

EMSCRIPTEN_KEEPALIVE uint32_t pm3_uart_rb_capacity(void) {
  return UART_RB_CAPACITY;
}

EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_stdin_head_ptr(void) {
  return (uintptr_t)&g_uart_stdin.head;
}

EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_stdin_tail_ptr(void) {
  return (uintptr_t)&g_uart_stdin.tail;
}

EMSCRIPTEN_KEEPALIVE uintptr_t pm3_uart_stdin_buf_ptr(void) {
  return (uintptr_t)&g_uart_stdin.data[0];
}

// Helper to read from stdin ring buffer (for proxmark3.c)
int uart_read_stdin(void) {
  uint8_t c;
  size_t n = rb_read(&g_uart_stdin, &c, 1);
  if (n > 0) {
    // printf("uart_read_stdin: got char %d (%c)\n", c, c);
    return (int)c;
  }
  return 0;
}

// ---------- UART Implementation ----------

int uart_reconfigure_timeouts(uint32_t value) {
  timeout_value = value;
  return PM3_SUCCESS;
}

uint32_t uart_get_timeouts(void) { return timeout_value; }

serial_port uart_open(const char *pcPortName, uint32_t speed, bool silent) {
  (void)pcPortName;
  (void)speed;

  // Reset ring buffers  // Reset head/tail
  atomic_store(&g_uart_rx.head, 0);
  atomic_store(&g_uart_rx.tail, 0);
  atomic_store(&g_uart_tx.head, 0);
  atomic_store(&g_uart_tx.tail, 0);

  // Mark as initialized
  atomic_store(&g_uart_rx.initialized, 1);
  atomic_store(&g_uart_tx.initialized, 1);

  printf("UART: Idle timeout logic active (v2)\n");

  if (!silent) {
    printf("WebSerial RingBuffer initialized\n");
    printf("C: rx head ptr: %p\n", &g_uart_rx.head);
    printf("C: rx buf ptr: %p\n", g_uart_rx.data);
  }
  return PM3_SUCCESS;
}

void uart_close(const serial_port sp) { (void)sp; }

int uart_receive(const serial_port sp, uint8_t *pbtRx, uint32_t pszMaxRxLen,
                 uint32_t *pszRxLen) {
  (void)sp;
  *pszRxLen = 0;

  if (pszMaxRxLen == 0)
    return PM3_SUCCESS;

  uint32_t total_read = 0;
  double start_time = emscripten_get_now();
  int spin_count = 0;

  // Try to read until buffer is full or timeout
  while (total_read < pszMaxRxLen) {
    size_t n =
        rb_read(&g_uart_rx, pbtRx + total_read, pszMaxRxLen - total_read);
    if (n > 0) {
      total_read += n;
      start_time =
          emscripten_get_now(); // Reset timeout on data arrival (idle timeout)
      spin_count = 0;
    } else {
      double now = emscripten_get_now();
      if (now - start_time > 500) { // 500ms idle timeout
        if (total_read > 0 && total_read < pszMaxRxLen) {
        }
        break; // Timeout
      }

      if (spin_count < 1000) {
        spin_count++;
        // Busy wait briefly to catch fast packets
      } else {
        emscripten_thread_sleep(1); // Yield to allow data to arrive
      }
    }
  }

  *pszRxLen = total_read;
  return PM3_SUCCESS;
}

int uart_send(const serial_port sp, const uint8_t *pbtTx, const uint32_t len) {
  (void)sp;

  // Write to TX ring buffer
  size_t written = rb_write(&g_uart_tx, pbtTx, len);

  if (written < len) {
    // Buffer full or partial write
    return PM3_EIO;
  }

  return PM3_SUCCESS;
}

bool uart_set_speed(serial_port sp, const uint32_t uiPortSpeed) {
  (void)sp;
  (void)uiPortSpeed;
  return true;
}

uint32_t uart_get_speed(const serial_port sp) {
  (void)sp;
  return 115200;
}

// Stubs
bool uart_bind(void *socket, const char *bindAddrStr, const char *bindPortStr,
               bool isBindingIPv6) {
  (void)socket;
  (void)bindAddrStr;
  (void)bindPortStr;
  (void)isBindingIPv6;
  return false;
}

int uart_parse_address_port(char *addrPortStr, const char **addrStr,
                            const char **portStr, bool *isIPv6) {
  (void)addrPortStr;
  (void)addrStr;
  (void)portStr;
  (void)isIPv6;
  return PM3_ENOTIMPL;
}

#endif // __EMSCRIPTEN__
