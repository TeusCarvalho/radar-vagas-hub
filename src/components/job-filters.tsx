import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRACT_LABELS, SENIORITY_LABELS, SOURCE_LABELS } from "@/types/job";

export interface FilterState {
  workplaceType: string;
  seniority: string;
  state: string;
  category: string;
  contractType: string;
  source: string;
}

interface JobFiltersProps {
  value: FilterState;
  states: string[];
  categories: string[];
  hasActiveFilters: boolean;
  onChange: (key: keyof FilterState, value: string) => void;
  onClear: () => void;
}

function FilterSelect({
  id,
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-full bg-background">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Painel horizontal: modalidade fica nos botões rápidos de /vagas,
 * enquanto os três filtros essenciais ficam próximos aos resultados.
 * Campos menos utilizados só aparecem ao expandir.
 */
export function JobFilters({
  value,
  states,
  categories,
  hasActiveFilters,
  onChange,
  onClear,
}: JobFiltersProps) {
  const advancedApplied = [value.contractType, value.source]
    .filter((item) => item !== "todos").length;
  const [showAdvanced, setShowAdvanced] = useState(advancedApplied > 0);

  const toOptions = (record: Record<string, string>) =>
    Object.entries(record)
      .filter(([key]) => key !== "nao_informado" && key !== "unknown")
      .map(([key, label]) => ({ value: key, label }));

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-label="Filtros de vagas"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Refine os resultados</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Combine nível, localização e área para encontrar vagas relevantes.
          </p>
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
            <X className="size-4" aria-hidden="true" />
            Limpar tudo
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          id="filtro-senioridade"
          label="Nível"
          allLabel="Todos os níveis"
          value={value.seniority}
          options={toOptions(SENIORITY_LABELS)}
          onChange={(v) => onChange("seniority", v)}
        />
        <FilterSelect
          id="filtro-estado"
          label="Estado"
          allLabel="Todos os estados"
          value={value.state}
          options={states.map((state) => ({ value: state, label: state }))}
          onChange={(v) => onChange("state", v)}
        />
        <FilterSelect
          id="filtro-area"
          label="Área profissional"
          allLabel="Todas as áreas"
          value={value.category}
          options={categories.map((category) => ({
            value: category,
            label: category,
          }))}
          onChange={(v) => onChange("category", v)}
        />
      </div>

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 rounded-md px-1 py-2 text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-expanded={showAdvanced}
        aria-controls="filtros-avancados"
        onClick={() => setShowAdvanced((current) => !current)}
      >
        {showAdvanced ? "Menos opções" : "Mais opções"}
        {advancedApplied > 0 && <span>({advancedApplied})</span>}
        <ChevronDown
          className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {showAdvanced && (
        <div id="filtros-avancados" className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <FilterSelect
            id="filtro-contrato"
            label="Tipo de contrato"
            allLabel="Todos os contratos"
            value={value.contractType}
            options={toOptions(CONTRACT_LABELS)}
            onChange={(v) => onChange("contractType", v)}
          />
          <FilterSelect
            id="filtro-origem"
            label="Plataforma"
            allLabel="Todas as plataformas"
            value={value.source}
            options={toOptions(SOURCE_LABELS)}
            onChange={(v) => onChange("source", v)}
          />
        </div>
      )}
    </section>
  );
}
