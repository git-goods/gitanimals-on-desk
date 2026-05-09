import { h } from "../react.js";
import { SettingRow, SwitchControl } from "../components.js";
export function ToggleRow({ label, desc, on, pending, disabled, onToggle, extraClass, }) {
    return (h(SettingRow, { label: label, desc: desc, extraClass: extraClass, control: h(SwitchControl, { on: on, pending: pending, disabled: disabled, onToggle: onToggle }) }));
}
