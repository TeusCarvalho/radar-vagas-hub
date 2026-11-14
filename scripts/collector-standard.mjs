export const WINDOW_DAYS = 7;

export const STANDARD_CATEGORIES = [
  "Dados e Analytics",
  "Business Intelligence",
  "Tecnologia",
  "Produto",
  "Comercial e Vendas",
  "Marketing e Growth",
  "Financeiro e Contábil",
  "Recursos Humanos",
  "Logística e Operações",
  "Engenharia",
  "Saúde",
  "Administrativo",
  "Atendimento e Suporte",
  "Jurídico",
  "Compras e Suprimentos",
  "Educação",
  "Negócios e Estratégia",
  "Design",
  "Outros",
];

const CATEGORY_SET = new Set(STANDARD_CATEGORIES);
const SENIORITY_SET = new Set([
  "estagio",
  "junior",
  "pleno",
  "senior",
  "especialista",
  "nao_informado",
]);
const WORKPLACE_SET = new Set(["remote", "hybrid", "onsite", "unknown"]);
const CONTRACT_SET = new Set(["clt", "pj", "estagio", "temporario", "nao_informado"]);

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoOrNull(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

export function cutoffDate(days = WINDOW_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function isWithinWindow(value, days = WINDOW_DAYS) {
  const date = parseDate(value);
  return date ? date >= cutoffDate(days) : false;
}

export function inferStandardSeniority(title = "", sourceLevel = "") {
  const text = normalizeText(`${title} ${sourceLevel}`);

  if (
    /\bestagio\b/.test(text) ||
    /\bestagiari[oa]\b/.test(text) ||
    /\bintern(ship)?\b/.test(text) ||
    /\btrainee\b/.test(text) ||
    /\bapprentice\b/.test(text)
  )
    return "estagio";

  if (/\bjunior\b/.test(text) || /\bjr\b/.test(text) || /\bentry.level\b/.test(text)) {
    return "junior";
  }

  if (/\bpleno\b/.test(text) || /\bmid.level\b/.test(text) || /\bmid\b/.test(text)) return "pleno";

  if (/\bsenior\b/.test(text) || /\bsr\b/.test(text)) return "senior";

  if (
    /\bespecialista\b/.test(text) ||
    /\bspecialist\b/.test(text) ||
    /\blead\b/.test(text) ||
    /\bstaff\b/.test(text) ||
    /\bprincipal\b/.test(text) ||
    /\bcoordenador/.test(text) ||
    /\bcoordinator\b/.test(text) ||
    /\bgerente\b/.test(text) ||
    /\bmanager\b/.test(text) ||
    /\bdirector\b/.test(text) ||
    /\bhead\b/.test(text)
  )
    return "especialista";

  return "nao_informado";
}

export function inferStandardCategory(title = "", extra = "") {
  const text = normalizeText(`${title} ${extra}`);

  const rules = [
    [
      "Business Intelligence",
      [
        /\bbusiness intelligence\b/,
        /\banalista de bi\b/,
        /\bbi analyst\b/,
        /\bconsultor(?:a)? de bi\b/,
      ],
    ],
    [
      "Dados e Analytics",
      [
        /\banalista de dados\b/,
        /\bdata analyst\b/,
        /\bdata analytics\b/,
        /\banalytics analyst\b/,
        /\bcientista de dados\b/,
        /\bdata scientist\b/,
        /\bengenheir[oa] de dados\b/,
        /\bdata engineer\b/,
        /\banalytics engineer\b/,
        /\bmachine learning\b/,
      ],
    ],
    [
      "Produto",
      [
        /\bproduct manager\b/,
        /\bproduct owner\b/,
        /\bproduct analyst\b/,
        /\banalista de produto\b/,
        /\bproduto\b/,
        /\bproduct\b/,
        /\bux\b/,
        /\bui\b/,
      ],
    ],
    [
      "Comercial e Vendas",
      [
        /\bvendas?\b/,
        /\bcomercial\b/,
        /\bsales\b/,
        /\bvendedor/,
        /\baccount executive\b/,
        /\baccount manager\b/,
        /\bbusiness development\b/,
        /\bsdr\b/,
        /\bbdr\b/,
      ],
    ],
    [
      "Marketing e Growth",
      [
        /\bmarketing\b/,
        /\bgrowth\b/,
        /\bperformance\b/,
        /\bseo\b/,
        /\bconteudo\b/,
        /\bcontent\b/,
        /\bmidia\b/,
        /\bsocial media\b/,
        /\bbrand\b/,
        /\bcommunications?\b/,
        /\brevenue operations\b/,
        /\brevops\b/,
      ],
    ],
    [
      "Financeiro e Contábil",
      [
        /\bfinanceir/,
        /\bfinance\b/,
        /\bfinancial\b/,
        /\bcontabil/,
        /\baccounting\b/,
        /\bfiscal\b/,
        /\btesouraria\b/,
        /\btreasury\b/,
        /\bcontroladoria\b/,
        /\btax\b/,
      ],
    ],
    [
      "Recursos Humanos",
      [
        /\brecursos humanos\b/,
        /\bhuman resources\b/,
        /\brecrutamento\b/,
        /\brecruit/,
        /\btalent acquisition\b/,
        /\bpeople\b/,
        /\bdepartamento pessoal\b/,
        /\brh\b/,
      ],
    ],
    [
      "Logística e Operações",
      [
        /\blogistic/,
        /\boperations?\b/,
        /\boperac/,
        /\bsupply chain\b/,
        /\barmazem\b/,
        /\bwarehouse\b/,
        /\bestoque\b/,
        /\bfrota\b/,
        /\bfleet\b/,
        /\btransport/,
        /\bexpedicao\b/,
        /\bfulfillment\b/,
      ],
    ],
    [
      "Engenharia",
      [
        /\bengenharia\b/,
        /\bengenheir[oa]\b/,
        /\bmechanical engineer/,
        /\belectrical engineer/,
        /\bcivil engineer/,
        /\bmanufacturing engineer/,
        /\bprojetista\b/,
      ],
    ],
    [
      "Saúde",
      [
        /\bsaude\b/,
        /\bhealth\b/,
        /\bclinical\b/,
        /\bmedical\b/,
        /\benferm/,
        /\bnurse\b/,
        /\bfarmac/,
        /\bfisioter/,
        /\bpsicolog/,
        /\bnutri/,
      ],
    ],
    [
      "Administrativo",
      [
        /\badministrativ/,
        /\badministration\b/,
        /\brecepcionista\b/,
        /\breception/,
        /\bsecretari/,
        /\boffice assistant\b/,
      ],
    ],
    [
      "Atendimento e Suporte",
      [
        /\batendimento\b/,
        /\bcustomer success\b/,
        /\bcustomer experience\b/,
        /\bcustomer service\b/,
        /\bcustomer support\b/,
        /\bsac\b/,
        /\bcall center\b/,
        /\bsuporte ao cliente\b/,
      ],
    ],
    [
      "Jurídico",
      [/\bjuridic/, /\badvogad/, /\blegal\b/, /\bcounsel\b/, /\bcompliance\b/, /\bparalegal\b/],
    ],
    [
      "Compras e Suprimentos",
      [
        /\bcompras\b/,
        /\bcomprador/,
        /\bprocurement\b/,
        /\bsuprimentos\b/,
        /\bsourcing\b/,
        /\bpurchasing\b/,
      ],
    ],
    [
      "Educação",
      [
        /\bprofessor/,
        /\bpedagog/,
        /\beducacao\b/,
        /\beducation\b/,
        /\binstrutor/,
        /\binstructor\b/,
        /\bteacher\b/,
      ],
    ],
    [
      "Negócios e Estratégia",
      [
        /\bbusiness analyst\b/,
        /\banalista de negocios\b/,
        /\binteligencia de negocios\b/,
        /\bestrategia\b/,
        /\bstrategy\b/,
        /\bstrategic\b/,
        /\bbusiness operations\b/,
        /\bplanejamento\b/,
      ],
    ],
    ["Design", [/\bdesigner\b/, /\bdesign\b/, /\bgrafico\b/, /\bcreative\b/]],
    [
      "Tecnologia",
      [
        /\bdesenvolvedor/,
        /\bdeveloper\b/,
        /\bsoftware\b/,
        /\bdevops\b/,
        /\bsre\b/,
        /\bquality assurance\b/,
        /\bprogramador/,
        /\bsistemas\b/,
        /\binfraestrutura\b/,
        /\binfrastructure\b/,
        /\bplatform\b/,
        /\bcloud\b/,
        /\bcibersegur/,
        /\bcyber/,
        /\bsecurity\b/,
        /\bseguranca da informacao\b/,
        /\bsuporte ti\b/,
        /\bengineering\b/,
        /\bsoftware engineer\b/,
        /\bqa\b/,
      ],
    ],
  ];

  for (const [category, patterns] of rules) {
    if (patterns.some((pattern) => pattern.test(text))) return category;
  }

  return "Outros";
}

function normalizeWorkplace(job) {
  const current = String(job.workplace_type ?? "").trim();
  if (WORKPLACE_SET.has(current)) return current;

  const text = normalizeText(`${job.source_workplace_type ?? ""} ${job.location_text ?? ""}`);

  if (/\bremote\b|\bremoto\b|\bhome office\b|\bwork from home\b/.test(text)) return "remote";
  if (/\bhybrid\b|\bhibrid/.test(text)) return "hybrid";
  if (/\bon.site\b|\bonsite\b|\bpresencial\b/.test(text)) return "onsite";
  return "unknown";
}

function normalizeContract(job) {
  const current = String(job.contract_type ?? "").trim();
  if (CONTRACT_SET.has(current) && current !== "nao_informado") return current;

  const text = normalizeText(`${job.source_contract_type ?? ""} ${job.description ?? ""}`);

  if (/\bintern(ship)?\b|\bestagio\b|\bapprentice\b/.test(text)) return "estagio";
  if (/\btemporary\b|\btemporari/.test(text)) return "temporario";
  if (/\bclt\b|consolidacao das leis do trabalho/.test(text)) return "clt";
  if (/\bpessoa juridica\b|\bpj\b|\bfreelance\b|\bfreelancer\b|\b1099\b/.test(text)) return "pj";

  return "nao_informado";
}

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function cleanSkills(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanString(item)).filter(Boolean))];
}

function finiteOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function standardizeJob(job, { nowIso = new Date().toISOString() } = {}) {
  const inferredCategory = inferStandardCategory(
    job.title ?? "",
    [job.department, job.team, job.category_extra].filter(Boolean).join(" "),
  );

  const existingCategory = CATEGORY_SET.has(job.category) ? job.category : null;
  const category =
    inferredCategory !== "Outros" ? inferredCategory : (existingCategory ?? "Outros");

  const inferredSeniority = inferStandardSeniority(
    job.title ?? "",
    job.source_seniority ?? job.level ?? "",
  );

  const existingSeniority = SENIORITY_SET.has(job.seniority) ? job.seniority : null;

  const seniority =
    inferredSeniority !== "nao_informado"
      ? inferredSeniority
      : (existingSeniority ?? "nao_informado");

  const publishedAt = toIsoOrNull(job.published_at);
  const applicationDeadline = toIsoOrNull(job.application_deadline);
  const firstSeenAt = toIsoOrNull(job.first_seen_at);
  const lastSeenAt = toIsoOrNull(job.last_seen_at) ?? nowIso;

  return {
    source: cleanString(job.source),
    external_id: cleanString(job.external_id),
    title: cleanString(job.title) ?? "",
    company: cleanString(job.company) ?? "Empresa não informada",
    category,
    seniority,
    workplace_type: normalizeWorkplace(job),
    source_workplace_type: cleanString(job.source_workplace_type),
    contract_type: normalizeContract(job),
    source_contract_type: cleanString(job.source_contract_type),
    location_text: cleanString(job.location_text) ?? "Local não informado",
    city: cleanString(job.city),
    state: cleanString(job.state),
    country: cleanString(job.country),
    salary_min: finiteOrNull(job.salary_min),
    salary_max: finiteOrNull(job.salary_max),
    salary_currency: cleanString(job.salary_currency),
    salary_interval: cleanString(job.salary_interval),
    salary_description: cleanString(job.salary_description),
    application_url: cleanString(job.application_url) ?? "",
    description: cleanString(job.description),
    skills: cleanSkills(job.skills),
    published_at: publishedAt,
    published_at_source: cleanString(job.published_at_source),
    application_deadline: applicationDeadline,
    first_seen_at: firstSeenAt,
    last_seen_at: lastSeenAt,
    active: job.active !== false,
  };
}

export function validateStandardJob(job) {
  const errors = [];
  if (!job.source) errors.push("source");
  if (!job.external_id) errors.push("external_id");
  if (!job.title) errors.push("title");
  if (!job.company) errors.push("company");
  if (!job.application_url) errors.push("application_url");
  if (!job.published_at) errors.push("published_at");
  return errors;
}

export function summarizeField(jobs, field) {
  const result = {};
  for (const job of jobs) {
    const value = job[field] ?? "nao_informado";
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}
