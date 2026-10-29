"use client";

import { Search, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { SlotPicker } from "@/components/hunts/slot-picker";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/panel/form";
import { Avatar } from "@/components/ui/avatar";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { giveManualTipeo, searchViewers, type ViewerOption } from "./actions";

const NOTE_MAX = 300;

/** Dar un tipeo a mano: elegir usuario, slot opcional y una descripción del motivo. */
export function ManualTipeoForm() {
  const [round, setRound] = useState(0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await giveManualTipeo(prev, data);
    // Después de darlo, el formulario queda vacío para el próximo.
    if (result.ok) setRound((r) => r + 1);
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form key={round} action={formAction} className="grid gap-3 lg:grid-cols-2">
      <UserPicker id={`${id}-user`} />
      <Field id={`${id}-slot`} label="Slot (opcional)">
        <SlotPicker id={`${id}-slot`} />
      </Field>
      <NoteField id={`${id}-note`} />
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <SubmitButton pendingLabel="Dando tipeo…">Dar tipeo</SubmitButton>
        {/* El mensaje de la última vez queda visible aunque el formulario se reinicie. */}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function NoteField({ id }: { id: string }) {
  const [length, setLength] = useState(0);
  return (
    <Field
      id={id}
      label="Descripción"
      hint="Por qué le das el tipeo. Le llega en la notificación y queda en la lista."
      className="lg:col-span-2"
    >
      <textarea
        id={id}
        name="note"
        required
        maxLength={NOTE_MAX}
        rows={3}
        placeholder="Ej.: Calleó Sugar Rush en el stream del sábado y pagó 500x."
        onChange={(e) => setLength(e.target.value.length)}
        className={cn(inputClass, "h-auto py-2")}
      />
      <span className="num mt-1 block text-right text-xs text-subtle">
        {length}/{NOTE_MAX}
      </span>
    </Field>
  );
}

/** Buscador de usuarios: escribís parte del nombre o del usuario de Twitch y elegís de la lista. */
function UserPicker({ id }: { id: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ViewerOption[]>([]);
  const [selected, setSelected] = useState<ViewerOption | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const listId = useId();
  const latest = useRef("");

  useEffect(() => {
    const q = query.trim();
    latest.current = q;
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchViewers(q);
        // Si mientras tanto se siguió escribiendo, esta respuesta ya no sirve.
        if (latest.current === q) setResults(found);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const shown = query.trim().length >= 2 ? results : [];

  if (selected) {
    return (
      <Field id={id} label="Usuario">
        <input type="hidden" name="user_id" value={selected.id} />
        <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2 px-2">
          <Avatar url={selected.avatarUrl} name={selected.name} size={24} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {selected.name}
            {selected.login ? <span className="font-normal text-subtle"> · {selected.login}</span> : null}
          </span>
          <button
            id={id}
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setResults([]);
            }}
            aria-label="Cambiar usuario"
            className="rounded-md p-1 text-subtle hover:bg-surface hover:text-text"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </Field>
    );
  }

  return (
    <Field id={id} label="Usuario" hint="Escribí al menos 2 letras del nombre o del usuario de Twitch.">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          id={id}
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          required
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar usuario…"
          className={cn(inputClass, "pl-9")}
        />
        {open && query.trim().length >= 2 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/50"
          >
            {shown.length ? (
              shown.map((user) => (
                <li key={user.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    // mousedown: se elige antes de que el input pierda el foco y cierre la lista.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelected(user);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <Avatar url={user.avatarUrl} name={user.name} size={24} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{user.name}</span>
                    {user.login ? <span className="text-xs text-subtle">{user.login}</span> : null}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-subtle">
                {pending ? "Buscando…" : "No hay usuarios con ese nombre."}
              </li>
            )}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
