"use client";

import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "@/components/panel/form";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string; provider: string | null };

/**
 * Autocompletado contra el catálogo (`search_slots`): busca por palabras en
 * cualquier orden, en el nombre y el proveedor. Manda `slot_id` si se eligió
 * una opción y siempre `slot_name` con el texto, para poder escribir un slot
 * que todavía no está cargado.
 */
export function SlotPicker({
  id,
  required,
  placeholder = "Buscá el slot",
}: {
  id: string;
  required?: boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Option | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selected?.name === query) return;
    const current = ++request.current;
    const timer = setTimeout(async () => {
      const { data } = await createClient().rpc("search_slots", { p_query: term, p_limit: 12 });
      if (current !== request.current) return;
      setOptions((data ?? []).map(({ id, name, provider }) => ({ id, name, provider })));
      setActive(-1);
      setOpen(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selected]);

  function choose(option: Option) {
    setSelected(option);
    setQuery(option.name);
    setOpen(false);
  }

  const expanded = open && options.length > 0;

  return (
    <div className="relative">
      <input type="hidden" name="slot_id" value={selected?.name === query ? selected.id : ""} />
      <input
        id={id}
        name="slot_name"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        required={required}
        maxLength={120}
        value={query}
        placeholder={placeholder}
        className={inputClass}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length < 2) setOpen(false);
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!expanded) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line-strong bg-surface-2 py-1 shadow-xl"
        >
          {options.map((option, i) => (
            <li
              key={option.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              className={cn("cursor-pointer px-3 py-2 text-sm", i === active ? "bg-accent/25" : "hover:bg-surface")}
            >
              <span className="font-semibold">{option.name}</span>
              {option.provider ? <span className="ml-2 text-xs text-subtle">{option.provider}</span> : null}
            </li>
          ))}
        </ul>
      ) : open && query.trim().length >= 2 && selected?.name !== query ? (
        <p
          aria-live="polite"
          className="absolute z-20 mt-1 w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs text-muted shadow-xl"
        >
          No está en el catálogo. Podés usar «{query.trim()}» igual.
        </p>
      ) : null}
    </div>
  );
}
