import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRACT_LABELS, SENIORITY_LABELS, SOURCE_LABELS, WORKPLACE_LABELS } from "@/types/job";

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
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full bg-surface">
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

export function JobFilters({
  value,
  states,
  categories,
  hasActiveFilters,
  onChange,
  onClear,
}: JobFiltersProps) {
  const toOptions = (record: Record<string, string>) =>
    Object.entries(record).map(([key, label]) => ({ value: key, label }));

  return (
    <section
      aria-label="Filtros de vagas"
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Filtros</h2>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-brand">
            <X className="size-4" aria-hidden="true" />
            Limpar
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <FilterSelect
          id="filtro-modalidade"
          label="Modalidade"
          allLabel="Todas as modalidades"
          value={value.workplaceType}
          options={toOptions(WORKPLACE_LABELS)}
          onChange={(v) => onChange("workplaceType", v)}
        />
        <FilterSelect
          id="filtro-senioridade"
          label="Senioridade"
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
          options={states.map((s) => ({ value: s, label: s }))}
          onChange={(v) => onChange("state", v)}
        />
        <FilterSelect
          id="filtro-area"
          label="Área profissional"
          allLabel="Todas as áreas"
          value={value.category}
          options={categories.map((c) => ({ value: c, label: c }))}
          onChange={(v) => onChange("category", v)}
        />
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
          label="Plataforma de origem"
          allLabel="Todas as plataformas"
          value={value.source}
          options={toOptions(SOURCE_LABELS)}
          onChange={(v) => onChange("source", v)}
        />
      </div>
    </section>
  );
}
