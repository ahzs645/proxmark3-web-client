// The LF/T55xx tools historically defined their own SectionLabel. It now lives
// in the shared panel kit so every panel's section headings match; this re-export
// keeps the existing `../shared` import path working.
export { SectionLabel } from "@/components/panels/shared/SectionLabel";
