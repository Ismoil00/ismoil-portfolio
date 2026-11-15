"use client";

import { LuX } from "react-icons/lu";
import { DragGrip, SortableList } from "@/components/ui/SortableList";
import { Picker, type PickerOption } from "./Picker";

/**
 * Several items from a list: a searchable dropdown plus the picked items as chips below,
 * in the order they'll be shown (drag a chip to move it, × to remove it).
 */
export function MultiPickField({
  id,
  options,
  value,
  onChange,
  placeholder = "Choose…",
  emptyText,
  invalid,
  sortable = true,
}: {
  id?: string;
  options: PickerOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: React.ReactNode;
  invalid?: boolean;
  sortable?: boolean;
}) {
  const byId = new Map(options.map((o) => [o.value, o]));
  const chip = (itemId: string, grip?: React.ReactNode) => {
    const option = byId.get(itemId);
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1.5 pr-1.5 text-sm">
        {grip}
        {option?.icon}
        <span className="max-w-56 truncate">{option?.label ?? "Removed item"}</span>
        <button
          type="button"
          onClick={() => onChange(value.filter((v) => v !== itemId))}
          aria-label={`Remove ${option?.label ?? "item"}`}
          className="grid size-6 place-items-center rounded-full text-faint hover:bg-tint/10 hover:text-fg"
        >
          <LuX className="size-3.5" />
        </button>
      </span>
    );
  };

  return (
    <div>
      <Picker id={id} multiple options={options} value={value} onChange={onChange} placeholder={placeholder} emptyText={emptyText} invalid={invalid} />
      {value.length > 0 &&
        (sortable && value.length > 1 ? (
          <SortableList
            items={value.map((v) => ({ id: v }))}
            onReorder={onChange}
            layout="grid"
            className="mt-3 flex flex-wrap gap-2"
            renderItem={({ id: itemId }, handle) => chip(itemId, <DragGrip handle={handle} />)}
          />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">{value.map((v) => <span key={v}>{chip(v)}</span>)}</div>
        ))}
    </div>
  );
}
