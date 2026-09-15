import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClientSkill, deleteClientSkill, getClientSkills, updateClientSkill } from "@/api";
import type { ClientSkill } from "@shared/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextEditor } from "@/components/ui/text_editor";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SkillsTab({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["client-skills", clientId];
  const skills = useQuery({ queryKey, queryFn: () => getClientSkills(clientId) });
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string; content: string; enabled: boolean } | null>(null);
  const save = useMutation({
    mutationFn: async (values: NonNullable<typeof editing>) => {
      const input = { enabled: values.enabled, name: values.name.trim(), description: values.description.trim(), content: values.content.trim() };
      return values.id
        ? updateClientSkill(clientId, values.id, input)
        : createClientSkill(clientId, input);
    },
    onSuccess: async (skill) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ClientSkill[]>(queryKey, (current = []) =>
        current.some((item) => item.id === skill.id)
          ? current.map((item) => item.id === skill.id ? skill : item)
          : [...current, skill]);
      setEditing(null);
    },
    onError: () => toast.error(t("skillsSaveFailed")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteClientSkill(clientId, id),
    onSuccess: async (_, id) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ClientSkill[]>(queryKey, (current = []) => current.filter((item) => item.id !== id));
    },
    onError: () => toast.error(t("skillsDeleteFailed")),
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateClientSkill(clientId, id, { enabled }),
    onSuccess: async (skill) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ClientSkill[]>(queryKey, (current = []) =>
        current.map((item) => item.id === skill.id ? skill : item));
    },
    onError: () => toast.error(t("skillsSaveFailed")),
  });
  const pending = save.isPending || remove.isPending || toggle.isPending;

  if (skills.isPending) return (
    <div className="grid gap-4">
      <Skeleton className="h-9 w-32" />
      {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
    </div>
  );
  if (skills.isError) return (
    <div className="grid justify-items-start gap-3">
      <p role="alert" className="text-sm text-destructive">{t("skillsLoadFailed")}</p>
      <Button variant="outline" onClick={() => void skills.refetch()}>{t("skillsRetry")}</Button>
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("skillsDescription")}</p>
        <Button disabled={pending} onClick={() => setEditing({ name: "", description: "", content: "", enabled: true })}>
          <Plus className="size-4" />{t("skillsAdd")}
        </Button>
      </div>
      {!skills.data.length && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("skillsEmpty")}</p>}
      {skills.data.map((skill) => (
        <div key={skill.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words font-medium">{skill.name}</h3>
              {skill.builtInKey && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("skillsBuiltIn")}</span>}
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{skill.description || t("skillsMissingDescription")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Switch className="mr-2" checked={skill.enabled} disabled={pending}
              aria-label={t("skillsEnabled", { name: skill.name })}
              onCheckedChange={(enabled) => toggle.mutate({ id: skill.id, enabled })} />
            {!skill.builtInKey && <Button variant="ghost" size="icon" disabled={pending} aria-label={t("skillsEdit")} onClick={() => setEditing(skill)}><Pencil className="size-4" /></Button>}
            {!skill.builtInKey && <Button variant="ghost" size="icon" disabled={pending} aria-label={t("skillsDelete")} onClick={() => remove.mutate(skill.id)}><Trash2 className="size-4" /></Button>}
          </div>
        </div>
      ))}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !save.isPending) setEditing(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t(editing?.id ? "skillsEdit" : "skillsAdd")}</DialogTitle>
            <DialogDescription>{t("skillsDescription")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="grid gap-4" onSubmit={(event) => {
              event.preventDefault();
              if (!pending) save.mutate(editing);
            }}>
              <div className="grid gap-2">
                <Label htmlFor="skill-name">{t("skillsName")}</Label>
                <Input id="skill-name" required maxLength={100} autoFocus disabled={save.isPending}
                  value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="skill-description">{t("skillsSummary")}</Label>
                <Input id="skill-description" maxLength={300} disabled={save.isPending}
                  placeholder={t("skillsSummaryPlaceholder")} value={editing.description}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="skill-content">{t("skillsContent")}</Label>
                <TextEditor id="skill-content" required maxLength={100_000} className="min-h-64" disabled={save.isPending}
                  value={editing.content} onChange={(content) => setEditing({ ...editing, content })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditing(null)}>{t("skillsCancel")}</Button>
                <Button type="submit" disabled={pending || !editing.name.trim() || !editing.content.trim()}>{t("skillsSave")}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
