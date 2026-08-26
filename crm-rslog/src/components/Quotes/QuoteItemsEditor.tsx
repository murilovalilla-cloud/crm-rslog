import { useState, type FormEvent } from "react";
import { useQuote, useAddQuoteItem, useDeleteQuoteItem } from "@/hooks/useQuotes";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { quoteItemFormSchema, type QuoteItemFormValues } from "@/lib/formSchemas";
import { formatCurrencyBRL } from "@/lib/utils";

const EMPTY_ITEM: QuoteItemFormValues = { description: "", quantity: "1", unit_value: "" };

/** Editor de itens de uma cotação — usado dentro do painel expandido de cada cotação. */
export function QuoteItemsEditor({ quoteId }: { quoteId: string }) {
  const { data, isLoading, error } = useQuote(quoteId);
  const addItem = useAddQuoteItem(quoteId);
  const deleteItem = useDeleteQuoteItem(quoteId);

  const [values, setValues] = useState<QuoteItemFormValues>(EMPTY_ITEM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = quoteItemFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    addItem.mutate(parsed.data, { onSuccess: () => setValues(EMPTY_ITEM) });
  };

  if (isLoading) return <LoadingSpinner label="Carregando itens..." className="py-4" />;
  if (error || !data) return <p className="py-2 text-sm text-red-600">Não foi possível carregar os itens.</p>;

  const items = data.items;
  const total = items.reduce((sum, item) => sum + item.total_value, 0);

  return (
    <div className="space-y-3 rounded-md bg-slate-50 p-3">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum item adicionado a esta cotação.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-1 font-medium">Descrição</th>
                <th className="pb-1 text-right font-medium">Qtd.</th>
                <th className="pb-1 text-right font-medium">Valor unit.</th>
                <th className="pb-1 text-right font-medium">Total</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="py-1.5 pr-2">{item.description}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right">{formatCurrencyBRL(item.unit_value)}</td>
                  <td className="py-1.5 text-right font-medium text-slate-700">{formatCurrencyBRL(item.total_value)}</td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => deleteItem.mutate(item.id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300">
                <td colSpan={3} className="pt-1.5 text-right text-xs font-medium uppercase text-slate-400">
                  Total dos itens
                </td>
                <td className="pt-1.5 text-right text-sm font-semibold text-slate-800">{formatCurrencyBRL(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <Input
            label="Descrição do item"
            value={values.description}
            error={errors.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
        <div className="w-20">
          <Input
            label="Qtd."
            inputMode="decimal"
            value={values.quantity}
            error={errors.quantity}
            onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.value }))}
          />
        </div>
        <div className="w-32">
          <Input
            label="Valor unit. (R$)"
            inputMode="decimal"
            placeholder="0,00"
            value={values.unit_value}
            error={errors.unit_value}
            onChange={(e) => setValues((v) => ({ ...v, unit_value: e.target.value }))}
          />
        </div>
        <Button type="submit" variant="secondary" className="!px-3 !py-1.5 text-xs" loading={addItem.isPending}>
          + Adicionar item
        </Button>
      </form>
    </div>
  );
}
