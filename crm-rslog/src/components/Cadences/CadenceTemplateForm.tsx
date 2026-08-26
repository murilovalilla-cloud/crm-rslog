import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Textarea } from "@/components/common/Textarea";
import { Button } from "@/components/common/Button";
import { cadenceTemplateFormSchema, type CadenceStepFormValues, type CadenceTemplateFormValues } from "@/lib/formSchemas";
import type { CadenceTemplateDetail } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/utils";

const STEP_TYPES = ["ligacao", "email", "whatsapp", "reuniao", "followup"] as const;
const STEP_TYPE_OPTIONS = STEP_TYPES.map((type) => ({ value: type, label: ACTIVITY_TYPE_LABELS[type] }));

function emptyStep(order: number): CadenceStepFormValues {
  return { step_order: order, type: "ligacao", day_offset: 0, title: "", description: "" };
}

interface CadenceTemplateFormProps {
  initial?: CadenceTemplateDetail | null;
  submitting?: boolean;
  onSubmit: (values: CadenceTemplateFormValues) => void;
  onCancel: () => void;
}

/** Formulário de modelo de cadência: nome/descrição + lista editável de passos (ligação, e-mail, WhatsApp, reunião, follow-up). */
export function CadenceTemplateForm({ initial, submitting, onSubmit, onCancel }: CadenceTemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [steps, setSteps] = useState<CadenceStepFormValues[]>(
    initial?.steps.length
      ? initial.steps.map((s) => ({
          id: s.id,
          step_order: s.step_order,
          type: s.type,
          day_offset: s.day_offset,
          title: s.title,
          description: s.description ?? "",
        }))
      : [emptyStep(1)]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateStep = (index: number, patch: Partial<CadenceStepFormValues>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const addStep = () => setSteps((prev) => [...prev, emptyStep(prev.length + 1)]);
  const removeStep = (index: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = cadenceTemplateFormSchema.safeParse({ name, description, steps });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nome da cadência" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="field-label !mb-0">Passos da cadência</p>
          <Button type="button" variant="secondary" className="!px-2 !py-1 text-xs" onClick={addStep}>
            + Adicionar passo
          </Button>
        </div>
        {errors.steps && <p className="field-error mb-2">{errors.steps}</p>}
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 rounded-md border border-slate-200 p-2">
              <div className="col-span-1 flex items-center justify-center text-sm font-semibold text-slate-400">
                {step.step_order}
              </div>
              <div className="col-span-2">
                <Select
                  options={STEP_TYPE_OPTIONS}
                  value={step.type}
                  onChange={(e) => updateStep(index, { type: e.target.value as CadenceStepFormValues["type"] })}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Dia"
                  value={step.day_offset}
                  onChange={(e) => updateStep(index, { day_offset: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-4">
                <Input
                  placeholder="Título do passo"
                  value={step.title}
                  error={errors[`steps.${index}.title`]}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Input
                  placeholder="Detalhe (opcional)"
                  value={step.description}
                  onChange={(e) => updateStep(index, { description: e.target.value })}
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300"
                  onClick={() => removeStep(index)}
                  disabled={steps.length <= 1}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          "Dia" é o número de dias após o início da cadência em que o passo deve gerar uma atividade.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar cadência
        </Button>
      </div>
    </form>
  );
}
