"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { useCloud, type RecipeInput } from "@/context/CloudContext";
import { useSelection } from "@/context/SelectionContext";
import { useSavedBlends } from "@/context/SavedBlendsContext";
import { useRack } from "@/context/RackContext";
import type { Tables } from "@/types/database";

const input = "mt-1 w-full rounded-md border border-rule bg-board px-3 py-2 text-body text-chalk";
const button = "rounded-md border border-rule-strong px-3 py-2 text-small text-chalk hover:bg-board-high disabled:cursor-wait disabled:opacity-50";

const subscribeLocation = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};
const confirmationFailed = () => new URLSearchParams(window.location.search).has("auth_error");
const serverConfirmationFailed = () => false;

export default function KitchenPanel() {
  const cloud = useCloud();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const failed = useSyncExternalStore(subscribeLocation, confirmationFailed, serverConfirmationFailed);
  const [dismissed, setDismissed] = useState(false);
  const visible = open || (failed && !dismissed);
  function close() { setOpen(false); setDismissed(true); }
  useEffect(() => {
    if (visible) dialog.current?.showModal();
    else dialog.current?.close();
  }, [visible]);
  return <>
    <button type="button" className={button + " whitespace-nowrap"} onClick={() => setOpen(true)}>My kitchen{cloud.error ? " !" : ""}</button>
    <dialog aria-labelledby="kitchen-title" ref={dialog} onCancel={close} onClose={close} className="m-auto max-h-[90dvh] w-[min(640px,94vw)] rounded-xl border border-rule bg-board-raised p-0 text-chalk shadow-2xl backdrop:bg-black/65">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-board-raised px-5 py-4">
        <h2 id="kitchen-title" className="font-display text-title">My kitchen</h2>
        <button type="button" className={button} onClick={close} aria-label="Close My kitchen">Close</button>
      </header>
      <div className="space-y-6 p-5">
        {!cloud.authReady ? <p role="status">Checking your account…</p> : cloud.user ? <Kitchen key={cloud.user.id} /> : <AccountForm />}
      </div>
    </dialog>
    {cloud.error && !visible && <div role="alert" className="fixed bottom-4 left-4 z-50 max-w-[90vw] rounded-lg border border-rule bg-board-raised p-3 text-small shadow-xl">{cloud.error} <button className="underline" onClick={() => setOpen(true)}>Open My kitchen</button></div>}
  </>;
}

function AccountForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  async function resend(form: HTMLFormElement) {
    const email = String(new FormData(form).get("email") || "").trim();
    if (!email) { setFailed(true); setNotice("Enter your email address first."); return; }
    setPending(true); setNotice(""); setFailed(false);
    try {
      const { error } = await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
      setNotice("If your account needs confirmation, a new email is on its way.");
    } catch (error) { setFailed(true); setNotice(error instanceof Error ? error.message : "Could not resend. Please try again."); }
    finally { setPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true); setNotice(""); setFailed(false);
    try {
      const client = createClient();
      const credentials = { email: String(fields.get("email")).trim(), password: String(fields.get("password")) };
      const result = mode === "signin" ? await client.auth.signInWithPassword(credentials) : await client.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) setNotice("Check your email to confirm your account, then sign in here.");
    } catch (error) { setFailed(true); setNotice(error instanceof Error ? error.message : "Could not sign in. Please try again."); }
    finally { setPending(false); }
  }
  if (!supabaseConfigured) return <p>Account saving is unavailable. Configure the Supabase URL and publishable key to enable it.</p>;
  return <section>
    <p className="mb-4 text-body text-chalk-2">Keep your blends, spice rack, and recipes together across devices. Guest blends and your rack stay on this browser until you import them.</p>
    <div className="mb-4 flex gap-2">{(["signin", "signup"] as const).map((m) => <button key={m} disabled={pending} className={button} aria-pressed={mode === m} onClick={() => { setMode(m); setNotice(""); }}>{m === "signin" ? "Sign in" : "Create account"}</button>)}</div>
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-small">Email<input className={input} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label className="block text-small">Password<input className={input} name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} required /></label>
      <button disabled={pending} className={button} type="submit">{pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      <button type="button" disabled={pending} className="block text-small text-chalk-3 underline" onClick={(e) => { if (e.currentTarget.form) void resend(e.currentTarget.form); }}>Resend confirmation email</button>
      {notice && <p role={failed ? "alert" : "status"} className="text-small text-chalk-2">{notice}</p>}
    </form>
    <ConfirmationError />
  </section>;
}

function ConfirmationError() {
  const failed = useSyncExternalStore(subscribeLocation, confirmationFailed, serverConfirmationFailed);
  return failed ? <p role="alert" className="mt-3 text-small">That confirmation link could not be used. Try signing in if your email is already confirmed, or request a new confirmation email.</p> : null;
}

function Kitchen() {
  const cloud = useCloud();
  const { selectedSpiceIds, selectSpices } = useSelection();
  const { blends, deleteBlend } = useSavedBlends();
  const { rackIds } = useRack();
  const [editing, setEditing] = useState<Tables<"recipes"> | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try { const { error } = await createClient().auth.signOut({ scope: "local" }); if (error) throw error; }
    catch { setNotice("Could not sign out. Please try again."); }
    finally { setSigningOut(false); }
  }
  async function importGuest() {
    setNotice("");
    try {
      const raw: unknown = JSON.parse(localStorage.getItem("spice-blends") || "[]");
      const rack: unknown = JSON.parse(localStorage.getItem("spice-rack") || "[]");
      if (!Array.isArray(raw) || !Array.isArray(rack) || !rack.every((s) => typeof s === "string")) throw new Error("Invalid browser data");
      const rows = raw.map((b: unknown) => {
        if (!b || typeof b !== "object" || !("id" in b) || !("name" in b) || !("slugs" in b) || !("createdAt" in b) || typeof b.id !== "string" || typeof b.name !== "string" || !Array.isArray(b.slugs) || !b.slugs.every((s) => typeof s === "string") || typeof b.createdAt !== "number") throw new Error("Invalid blend");
        return { id: `${cloud.user!.id}:${b.id}`, name: b.name, slugs: b.slugs as string[], created_at: new Date(b.createdAt).toISOString(), user_id: cloud.user!.id };
      });
      const ok = await cloud.write(async (client) => {
        if (rows.length) { const result = await client.from("saved_blends").upsert(rows, { onConflict: "id", ignoreDuplicates: true }); if (result.error) return result; }
        return client.rpc("merge_rack_spices", { spice_slugs: rack as string[] });
      });
      if (ok) setNotice("Browser blends and rack imported. The originals remain on this browser.");
    } catch { setNotice("Could not import browser data. Your originals are unchanged."); }
  }
  const disabled = cloud.busy || !cloud.ready || signingOut;
  return <>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-small text-chalk-2">{cloud.user?.email}</p><button className={button} disabled={cloud.busy || signingOut} onClick={signOut}>Sign out</button></div>
      <p role="status" className="text-small text-chalk-3">{cloud.busy ? "Saving…" : !cloud.ready ? "Loading your kitchen…" : "Saved to your account. Refreshes across devices every 30 seconds and when you return."}</p>
      {cloud.error && <p role="alert" className="text-small">{cloud.error}</p>}
      <div className="flex flex-wrap gap-2"><button className={button} disabled={cloud.busy} onClick={() => void cloud.refresh()}>Refresh / retry</button><button className={button} disabled={disabled} onClick={importGuest}>Import browser blends &amp; rack</button></div>
      {notice && <p role="status" className="text-small">{notice}</p>}
    </section>
    <section className="border-t border-rule pt-4"><h3 className="font-display text-lead">My rack</h3><p className="mt-2 text-small text-chalk-2">{rackIds.size ? [...rackIds].map((s) => s.replaceAll("-", " ")).join(", ") : "Your rack is empty. Mark spices you own in Substitutes."}</p></section>
    <section className="border-t border-rule pt-4"><h3 className="font-display text-lead">Saved blends</h3>{blends.length ? <ul className="divide-y divide-rule">{blends.map((b) => <li key={b.id} className="flex items-center gap-2 py-3"><span className="min-w-0 flex-1 break-words">{b.name}</span><button disabled={disabled} className={button} onClick={() => selectSpices(b.slugs)}>Load</button><button disabled={disabled} className={button} onClick={() => { if (window.confirm(`Delete “${b.name}”?`)) void deleteBlend(b.id); }}>Delete</button></li>)}</ul> : <p className="mt-2 text-small text-chalk-3">Select spices and save a blend from the blend builder.</p>}</section>
    <section className="space-y-3 border-t border-rule pt-4">
      <div className="flex items-center justify-between"><h3 className="font-display text-lead">Recipes</h3><button disabled={disabled} className={button} onClick={() => setEditing("new")}>New recipe</button></div>
      {editing && <RecipeForm key={typeof editing === "string" ? editing : editing.id} recipe={editing === "new" ? null : editing} selectedSlugs={[...selectedSpiceIds]} onClose={() => setEditing(null)} />}
      {!cloud.recipes.length && !editing && <p className="text-small text-chalk-3">Save ingredients, instructions, and the spices you use.</p>}
      {cloud.recipes.map((r) => <article key={r.id} className="rounded-lg border border-rule p-3">
        <h4 className="break-words font-display text-lead">{r.title}</h4>
        <details className="mt-2 text-small text-chalk-2"><summary className="cursor-pointer">View recipe</summary><h5 className="mt-3 font-medium">Ingredients</h5><p className="whitespace-pre-wrap break-words">{r.ingredients || "No ingredients added."}</p><h5 className="mt-3 font-medium">Instructions</h5><p className="whitespace-pre-wrap break-words">{r.instructions || "No instructions added."}</p><p className="mt-3">Spices: {r.slugs.join(", ") || "None linked"}</p></details>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={disabled} className={button} onClick={() => setEditing(r)}>Edit</button>{r.slugs.length > 0 && <button className={button} onClick={() => selectSpices(r.slugs)}>Load spices</button>}<button disabled={disabled} className={button} onClick={() => { if (window.confirm(`Delete “${r.title}”?`)) void cloud.write((client, userId) => client.from("recipes").delete().eq("id", r.id).eq("user_id", userId)); }}>Delete</button></div>
      </article>)}
    </section>
  </>;
}

function RecipeForm({ recipe, selectedSlugs, onClose }: { recipe: Tables<"recipes"> | null; selectedSlugs: string[]; onClose: () => void }) {
  const cloud = useCloud();
  const [slugs, setSlugs] = useState(recipe?.slugs ?? selectedSlugs);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value: RecipeInput = { title: String(fields.get("title")).trim(), ingredients: String(fields.get("ingredients")), instructions: String(fields.get("instructions")), slugs };
    if (!value.title) return;
    setSaving(true);
    const ok = await cloud.write((client, userId) => recipe
      ? client.from("recipes").update(value).eq("id", recipe.id).eq("user_id", userId)
      : client.from("recipes").insert({ ...value, user_id: userId }));
    setSaving(false);
    if (ok) onClose();
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg border border-rule p-3">
    <label className="block text-small">Recipe name<input name="title" className={input} defaultValue={recipe?.title} maxLength={200} required /></label>
    <label className="block text-small">Ingredients<textarea name="ingredients" className={input} rows={4} defaultValue={recipe?.ingredients} maxLength={20000} placeholder="One ingredient per line, including quantities" /></label>
    <label className="block text-small">Instructions<textarea name="instructions" className={input} rows={5} defaultValue={recipe?.instructions} maxLength={50000} /></label>
    <p className="text-small text-chalk-3">Linked spices: {slugs.join(", ") || "None"}</p>
    <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={saving} onClick={() => setSlugs(selectedSlugs)}>Use current map selection</button><button type="submit" className={button} disabled={saving || cloud.busy}>{saving ? "Saving…" : "Save recipe"}</button><button type="button" className={button} disabled={saving} onClick={onClose}>Cancel</button></div>
  </form>;
}
