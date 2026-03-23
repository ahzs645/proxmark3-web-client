import { PM3WebUSB } from "./pm3-webusb/controller";

export { PM3WebUSB } from "./pm3-webusb/controller";
export { UartShared, uartShared } from "./pm3-webusb/uartShared";

const pm3WebUSB = new PM3WebUSB();

if (typeof window !== "undefined") {
  (window as Window & { pm3WebUSB?: PM3WebUSB }).pm3WebUSB = pm3WebUSB;
}

export default pm3WebUSB;
