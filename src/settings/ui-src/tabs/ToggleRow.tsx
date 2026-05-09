import { h } from "../react.js";
import { SettingRow, SwitchControl } from "../components.js";

export function ToggleRow({
  label,
  desc,
  on,
  pending,
  disabled,
  onToggle,
  extraClass,
}: any) {
  return (
    <SettingRow
      label={label}
      desc={desc}
      extraClass={extraClass}
      control={
        <SwitchControl
          on={on}
          pending={pending}
          disabled={disabled}
          onToggle={onToggle}
        />
      }
    />
  );
}
