"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Field, FormMessage, inputClass, SubmitButton, textareaClass } from "@/components/panel/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { REWARD_KINDS } from "@/lib/rewards";
import type { Enums } from "@/types/database";
import { adjustPoints, handleOrder, saveMission, saveRewards, saveShopItem } from "./actions";

const numInput = cn(inputClass, "num");

export function RewardsForm({ rewards }: { rewards: Record<string, { points: number; xp: number }> }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveRewards, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REWARD_KINDS.map((reward) => (
          <fieldset key={reward.key} className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">{reward.label}</legend>
            <p className="mb-2 text-xs text-subtle">{reward.description}</p>
            <div className="grid grid-cols-2 gap-2">
              <Field id={`${id}-${reward.key}-p`} label="Puntos">
                <input
                  id={`${id}-${reward.key}-p`}
                  name={`${reward.key}_points`}
                  type="number"
                  min={0}
                  max={100000}
                  required
                  defaultValue={rewards[reward.key]?.points ?? 0}
                  className={numInput}
                />
              </Field>
              <Field id={`${id}-${reward.key}-x`} label="XP">
                <input
                  id={`${id}-${reward.key}-x`}
                  name={`${reward.key}_xp`}
                  type="number"
                  min={0}
                  max={100000}
                  required
                  defaultValue={rewards[reward.key]?.xp ?? 0}
                  className={numInput}
                />
              </Field>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Guardar premios</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type Mission = {
  id: string;
  title: string;
  description: string | null;
  type: Enums<"mission_type">;
  points: number;
  xp: number;
  url: string | null;
  code: string | null;
  startsAt: string;
  endsAt: string;
  is_active: boolean;
  sort_order: number;
};

export function MissionForm({ mission }: { mission?: Mission }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<Enums<"mission_type">>(mission?.type ?? "daily");
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await saveMission(prev, data);
    if (result.ok && !mission) formRef.current?.reset();
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {mission ? <input type="hidden" name="id" value={mission.id} /> : null}
      <Field id={`${id}-title`} label="Título" className="sm:col-span-2">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={80}
          defaultValue={mission?.title}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-type`} label="Tipo">
        <select
          id={`${id}-type`}
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as Enums<"mission_type">)}
          className={inputClass}
        >
          <option value="daily">Diaria (check-in)</option>
          <option value="code">Palabra secreta</option>
          <option value="link">Link (una vez)</option>
        </select>
      </Field>
      {type === "code" ? (
        <Field
          id={`${id}-code`}
          label="Palabra secreta"
          hint={
            mission ? `Actual: ${mission.code ?? "—"}. Dejala vacía para no cambiarla.` : "No distingue mayúsculas."
          }
        >
          <input id={`${id}-code`} name="code" maxLength={40} autoComplete="off" className={inputClass} />
        </Field>
      ) : type === "link" ? (
        <Field id={`${id}-url`} label="Link">
          <input
            id={`${id}-url`}
            name="url"
            type="url"
            required
            placeholder="https://"
            defaultValue={mission?.url ?? ""}
            className={inputClass}
          />
        </Field>
      ) : (
        <div />
      )}
      <Field id={`${id}-desc`} label="Descripción (opcional)" className="sm:col-span-2 lg:col-span-4">
        <input
          id={`${id}-desc`}
          name="description"
          maxLength={300}
          defaultValue={mission?.description ?? ""}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-points`} label="Puntos">
        <input
          id={`${id}-points`}
          name="points"
          type="number"
          min={0}
          required
          defaultValue={mission?.points ?? 20}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-xp`} label="XP">
        <input
          id={`${id}-xp`}
          name="xp"
          type="number"
          min={0}
          required
          defaultValue={mission?.xp ?? 10}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-start`} label="Desde (opcional, hora AR)">
        <input
          id={`${id}-start`}
          name="starts_at"
          type="datetime-local"
          defaultValue={mission?.startsAt}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-end`} label="Hasta (opcional)">
        <input
          id={`${id}-end`}
          name="ends_at"
          type="datetime-local"
          defaultValue={mission?.endsAt}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-order`} label="Orden">
        <input
          id={`${id}-order`}
          name="sort_order"
          type="number"
          min={0}
          max={999}
          defaultValue={mission?.sort_order ?? 0}
          className={numInput}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={mission?.is_active ?? true}
            className="size-4 accent-accent"
          />
          Activa
        </label>
        <SubmitButton>{mission ? "Guardar" : "Crear misión"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type Item = {
  id: string;
  title: string;
  description: string | null;
  kind: Enums<"shop_item_kind">;
  tickets: number | null;
  cost: number;
  stock: number | null;
  per_user_limit: number | null;
  min_level: number;
  is_active: boolean;
  sort_order: number;
  image_path: string | null;
};

export function ShopItemForm({ item }: { item?: Item }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<Enums<"shop_item_kind">>(item?.kind ?? "reward");
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await saveShopItem(prev, data);
    if (result.ok && !item) formRef.current?.reset();
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Field id={`${id}-title`} label="Nombre" className="sm:col-span-2">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={80}
          defaultValue={item?.title}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-kind`} label="Tipo">
        <select
          id={`${id}-kind`}
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Enums<"shop_item_kind">)}
          className={inputClass}
        >
          <option value="reward">Premio (lo entrega el admin)</option>
          <option value="tickets">Tickets de sorteo (automático)</option>
        </select>
      </Field>
      {kind === "tickets" ? (
        <Field id={`${id}-tickets`} label="Tickets que da">
          <input
            id={`${id}-tickets`}
            name="tickets"
            type="number"
            min={1}
            required
            defaultValue={item?.tickets ?? 1}
            className={numInput}
          />
        </Field>
      ) : (
        <div />
      )}
      <Field id={`${id}-desc`} label="Descripción (opcional)" className="sm:col-span-2 lg:col-span-4">
        <textarea
          id={`${id}-desc`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={item?.description ?? ""}
          className={textareaClass}
        />
      </Field>
      <Field id={`${id}-cost`} label="Costo en puntos">
        <input
          id={`${id}-cost`}
          name="cost"
          type="number"
          min={1}
          required
          defaultValue={item?.cost}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-stock`} label="Stock" hint="Vacío = sin límite.">
        <input
          id={`${id}-stock`}
          name="stock"
          type="number"
          min={0}
          defaultValue={item?.stock ?? ""}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-limit`} label="Máximo por persona" hint="Vacío = sin límite.">
        <input
          id={`${id}-limit`}
          name="per_user_limit"
          type="number"
          min={1}
          defaultValue={item?.per_user_limit ?? ""}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-level`} label="Nivel mínimo">
        <input
          id={`${id}-level`}
          name="min_level"
          type="number"
          min={1}
          required
          defaultValue={item?.min_level ?? 1}
          className={numInput}
        />
      </Field>
      <Field id={`${id}-image`} label="Imagen (opcional)">
        <input
          id={`${id}-image`}
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
      </Field>
      <Field id={`${id}-order`} label="Orden">
        <input
          id={`${id}-order`}
          name="sort_order"
          type="number"
          min={0}
          max={999}
          defaultValue={item?.sort_order ?? 0}
          className={numInput}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={item?.is_active ?? true}
            className="size-4 accent-accent"
          />
          Visible en la tienda
        </label>
        {item?.image_path ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="remove_image" className="size-4 accent-accent" />
            Quitar imagen
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{item ? "Guardar" : "Agregar a la tienda"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function OrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(handleOrder, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={orderId} />
      <label htmlFor={id} className="sr-only">
        Nota para el viewer
      </label>
      <input id={id} name="note" maxLength={300} placeholder="Nota (opcional)" className={cn(inputClass, "h-9 w-56")} />
      <button
        type="submit"
        name="decision"
        value="deliver"
        disabled={pending}
        className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-[#8a2cec] disabled:opacity-50"
      >
        Entregado
      </button>
      <button
        type="submit"
        name="decision"
        value="cancel"
        disabled={pending}
        className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-live disabled:opacity-50"
      >
        Cancelar y devolver
      </button>
      <FormMessage state={state} className="w-full" />
    </form>
  );
}

export function AdjustForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await adjustPoints(prev, data);
    if (result.ok) formRef.current?.reset();
    return result;
  }, INITIAL_ACTION_STATE);
  const id = useId();
  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_2fr_auto] sm:items-end">
      <Field id={`${id}-login`} label="Usuario de Twitch">
        <input id={`${id}-login`} name="login" required placeholder="usuario" className={inputClass} />
      </Field>
      <Field id={`${id}-points`} label="Puntos (±)">
        <input id={`${id}-points`} name="points" type="number" required defaultValue={0} className={numInput} />
      </Field>
      <Field id={`${id}-xp`} label="XP (+)">
        <input id={`${id}-xp`} name="xp" type="number" min={0} required defaultValue={0} className={numInput} />
      </Field>
      <Field id={`${id}-note`} label="Motivo">
        <input
          id={`${id}-note`}
          name="note"
          required
          maxLength={200}
          placeholder="Ganó el sorteo de Discord"
          className={inputClass}
        />
      </Field>
      <SubmitButton className="sm:mb-0.5">Aplicar</SubmitButton>
      <FormMessage state={state} className="sm:col-span-5" />
    </form>
  );
}
