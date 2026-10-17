# Чеклист лабораторної: що зроблено, що ні

Стан на 2026-10-16, `main` = `d7412d5`. Ліва колонка — вимога з лабораторної, права — що є в репозиторії.

Позначки: ✅ зроблено · 🟡 частково або зроблено інакше · ❌ немає · ❓ потрібне ваше рішення · ⏳ пізніший етап

**Рішення власника (2026-10-16).**
- Назви лишаються: repo `DevDigest-AI-Marketplace`, маркетплейс `devdigest-marketplace`.
- Збіг із лабораторною потрібен «плюс-мінус», не дослівно: еквівалент (Astro замість Vite, вбудований індексатор) — ок.
- Release, встановлення в інший проєкт, `1.1.0` і rollback — **пізніший етап**. Зараз доводимо до ладу стартові вимоги (кроки 1–7) і готуємо підґрунтя для 8–9.

## Підсумок по результатах лабораторної

| Результат | Стан | Коротко |
|---|---|---|
| GitHub repository `dev-digest-ai-marketplace` | ✅ | `DevDigest-AI-Marketplace` / `devdigest-marketplace` — назви лишаємо за рішенням власника |
| Чотири плагіни | ✅ | Встановлюються, залежності резолвляться |
| Статичний каталог на GitHub Pages | ✅ | Живий: https://dmytrivdev.github.io/DevDigest-AI-Marketplace/ (HTTP 200) |
| Release `sdd-engineering@1.0.0` в іншому проєкті | ⏳ | Тегів і релізів немає, в інший проєкт не встановлювали |
| Cost baseline і одна оптимізація | ✅ | `docs/COST-BASELINE.md`: DeepSeek v4-pro, 3+3 прогони, $1.20 загалом; оптимізація без втрати якості, економія в межах шуму |
| Оновлення до `1.1.0` | ⏳ | — |
| Описаний і прорепетируваний rollback до `1.0.0` | ❌ / ⏳ | Описати в `RELEASES.md` — зараз; репетиція — пізніше |

**Найбільше лишилося в кроках 8–9** (cost, release, встановлення, оновлення, rollback) і **в документах кроку 1**. Плагіни й сайт по суті готові, але потребують дрібних доробок.

---

## Крок 1. Окремий repository

| Вимога | Стан | Що є / що робити |
|---|---|---|
| Окремий repo, не в DevDigest | ✅ | Окремий публічний repo |
| Назва `dev-digest-ai-marketplace` | ✅ | Лишаємо `DevDigest-AI-Marketplace` (рішення власника) |
| `.claude-plugin/marketplace.json` | ✅ | |
| `.github/workflows/pages.yml` | ✅ | Збирає сайт на PR і деплоїть після merge, плюс щоденний cron |
| `.github/workflows/validate.yml` | ❌ | `scripts/validate.mjs` є, але жоден workflow його не запускає. На сайті `claude plugin validate` — лише неблокуючий бейдж |
| `plugins/` — чотири плагіни | ✅ | |
| `docs/PLUGIN-GUIDELINES.md` | 🟡 | Є `docs/temp/plugin-authoring-guide.md` — треба перенести й перейменувати |
| `docs/SITE-SPEC.md` | 🟡 | Є `docs/temp/catalog-site.md`, детальніший за вимогу — перенести й перейменувати |
| `docs/SECURITY.md` | ❌ | Заборона secrets і absolute paths, дії після небезпечного релізу |
| `docs/RELEASES.md` | ❌ | SemVer, tags, update, release channels, rollback |
| `docs/COST-BASELINE.md` | ❌ | Див. крок 8 |
| `scripts/build-index.mjs` | 🟡 | Індексатор вбудований у сайт (`site/src/data/build-*.ts`, викликається з `astro build`). Окремої команди `npm run build:index` немає |
| `site/` | ✅ | |
| `CODEOWNERS` | ✅ | Чотири плагіни прописані |
| Ruleset, який вимагає review від code owners | ❌ | `main` не захищений, rulesets порожні |
| `CONTRIBUTING.md` | 🟡 | Структура, manifest, перевірки, PR checklist є. **Немає правил про `dependencies` між плагінами** (діапазони, порядок релізу) |
| `README.md` | ✅ | |
| Новий автор зробить PR, не питаючи в чаті | 🟡 | Після доповнення `CONTRIBUTING.md` і `validate.yml` — так |

## Крок 2. Переносиме і локальне

| Вимога | Стан | Що є / що робити |
|---|---|---|
| SDD-агенти (4), `run-plan`, `workflow-retro` | ✅ | Без шляхів DevDigest, перевірено grep-ом |
| Generalized `engineering-insights` | ❌ ❓ | Не перенесено. Зараз скіл прив'язаний до пакетів DevDigest (`client`, `server`, `reviewer-core`, `e2e`); переписати його можна на конфіг `knowledgeFiles` |
| Hooks | ❌ ❓ | Не перенесено. У DevDigest є `commit-test-gate` (загальний за ідеєю) та `insights-*` (прив'язані до `engineering-insights`) |
| Behavior evals | 🟡 | 10 кейсів у форматі `claude plugin eval`, жодного разу не запускались |
| Розкладка на 4 групи (reusable / project-specific / integrations / локальне) | 🟡 | Описана в `docs/temp/sdd-plugins.md` §1 (Non-goals), але немає таблиці «файл → owner → consumer scenario → чому оновлюється разом» |

## Крок 3. Dependency graph

| Вимога | Стан | Що є / що робити |
|---|---|---|
| Граф `sdd-engineering → 3`, `architecture-review → engineering-paved-path`, `^1.0.0` | ✅ | Точно як у лабораторній |
| `claude plugin list --json` без `dependency-unsatisfied` / `range-conflict` / `no-matching-tag` | ✅ | Перевірено в ізольованому конфігу: 4 плагіни, усі увімкнені, 0 помилок |
| Namespaced посилання | ✅ | |
| `architecture-reviewer` читає repo-local architecture docs | ✅ | Через конфіг `knowledgeFiles` / `routing` |
| Склад `engineering-paved-path` | 🟡 | Лабораторна перелічує ще Drizzle, PostgreSQL, Zod, TypeScript і Mermaid, але каже «лише те, що реально потрібно». Ми свідомо взяли 7 (рішення OQ-1), Mermaid лежить у `sdd-engineering`. Варто записати це обґрунтування в README |

## Крок 4. Збираємо `sdd-engineering`

| Вимога | Стан | Що є / що робити |
|---|---|---|
| `skills/run-plan`, `workflow-retro` | ✅ | |
| `skills/engineering-insights` | ❌ ❓ | Див. крок 2 |
| `agents/` × 4 | ✅ | |
| `evals/` | ✅ | 5 кейсів |
| `README.md`, `CHANGELOG.md` | ✅ | |
| `COMPATIBILITY.md` (Claude Code `>=2.1.110`) | ❌ | Немає в жодному плагіні |
| 1. Без шляхів і назв DevDigest | ✅ | |
| 2. Явні inputs замість припущень про структуру | ✅ | `.claude/sdd-engineering.json` |
| 3. Переглянуто tools і permissions агентів | ✅ | |
| 4. Namespaced dependencies | ✅ | |
| 5. Задокументовано, де створюються spec і plan | ✅ | `specsDir`, `plansDir` |
| 6. Поведінка без test command | ✅ | `sdd-format` §6: «not run», `run-plan` питає один раз |
| 7–8. `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}` | ✅ | |
| 9. Без credentials у manifest | ✅ | |
| 10. Без дублів між agent prompts і skills | 🟡 | Шаблони винесено в `sdd-format`. Глибший прохід — це саме оптимізація з кроку 8 |
| Перевірка: не читає неописаних файлів DevDigest | ✅ | Grep чистий, встановлення в кеш працює |

## Крок 5. Реєстрація в marketplace

| Вимога | Стан | Що є / що робити |
|---|---|---|
| 4 entries, `source` відносний | ✅ | |
| Назва маркетплейсу `dev-digest-ai-marketplace` | ✅ | Лишаємо `devdigest-marketplace` (рішення власника) |
| `$schema` | ❌ | Додати `https://json.schemastore.org/claude-code-marketplace.json` |
| `version` лише в `plugin.json` | ✅ | `validate.mjs` це перевіряє |
| `claude plugin validate .` бачить 4 плагіни, імена збігаються | ✅ | |

## Крок 6. Каталог на GitHub Pages

Сайт зроблено на Astro (статичні сторінки + один React-острів) замість React + Vite з hash routing. Сторінки функціонально покривають ті самі маршрути: `/`, `/plugins/<name>/`, `/plugins/<name>/<type>/<slug>/`, `/whats-new/`, `/guide/`, а також `/stats/` і `feed.xml`.

| Вимога | Стан | Що є / що робити |
|---|---|---|
| Spec із routes, полями індексу, пошуком, detail page; без backend і ratings | ✅ | `docs/temp/catalog-site.md` |
| Індекс із marketplace, manifests, README, changelog, frontmatter | ✅ | |
| …і з `COMPATIBILITY.md` | ❌ | Індексатор його не читає (файлів поки й немає) |
| Пошук MiniSearch по name, description, keywords, README, `SKILL.md` | ✅ | |
| Markdown санітизується | ✅ | unified + `rehype-sanitize` (еквівалент marked + DOMPurify) |
| Сторінка плагіна: version, owner, components, install | ✅ | |
| …compatibility | ❌ | |
| …**dependencies** | ❌ | Індексатор ігнорує `dependencies` з `plugin.json`. Це головна прогалина сайту |
| Install-команда `@dev-digest-ai-marketplace` | ✅ | Береться з `marketplace.json`: `@devdigest-marketplace` — правильна для нашої назви |
| Вкладені skills і agents шукаються, мають свої сторінки | ✅ | |
| Generated JSON і `site/dist/` не в git | ✅ | |
| PR збирає index і frontend, `pages.yml` публікує після merge | ✅ | |
| `npm run build:index` + `site: npm ci && build && preview` | 🟡 | Немає `build:index`: індекс будується всередині `npm run build`. Можна або додати alias, або пояснити в README |

## Крок 7. Валідація структури й поведінки

| Вимога | Стан | Що є / що робити |
|---|---|---|
| `claude plugin validate` по кожному плагіну і по `.` | ✅ | Проходить і без `--strict`, і з ним |
| Не використовувати `--strict` | 🟡 ❓ | `scripts/validate.mjs` використовує `--strict`. На CLI 2.1.301 це працює, але прапор не задокументований. Можна лишити як додаткову перевірку або прибрати за лабораторною |
| Запуск з `--plugin-dir` | 🟡 | Документовано (`claude --plugin-dir ./plugins` вантажить усі чотири), але живого прогону не було |
| `spec-creator` уточнює і пише spec без implementation details | ❌ | Behavior не перевірявся на реальному прогоні |
| `implementation-planner` читає spec, не вигадує вимог | ❌ | — |
| `run-plan` передає tasks у `implementer` | ❌ | — |
| Review gate кличе `architecture-reviewer` | ❌ | — |
| `plan-verifier` перевіряє AC | ❌ | — |
| `workflow-retro` лише за явним запитом | 🟡 | `disable-model-invocation: true` + eval-кейс, не запущений |
| Namespaced skills без warnings | ❌ | Головний відкритий технічний ризик: preload `skills:` з namespace не задокументований. Є запасний шлях через `Skill` |
| Нерелевантний запит не активує SDD | ❌ | Немає eval-кейсу |

## Крок 8. Cost baseline і оптимізація

| Вимога | Стан |
|---|---|
| Фіксований сценарій «spec + plan для невеликої фічі» | ❌ |
| Eval set із acceptance criteria для нього | 🟡 Є окремі кейси (`spec-creator` Pass 1, planner відмовляє на marker), але не end-to-end сценарій |
| Кілька прогонів на одній моделі, метрики (SHA, model, tokens, calls, median cost / latency, pass rate, critical errors) | ❌ |
| `docs/COST-BASELINE.md` | ❌ |
| Одна оптимізація (прибрати дублі з agent prompts) і повторний прогін | ❌ |

Це платні прогони моделі — потрібна ваша згода і бюджет.

## Крок 9. Release `sdd-engineering@1.0.0`

| Вимога | Стан |
|---|---|
| Теги `engineering-paved-path--v1.0.0`, `research-tools--v1.0.0`, `architecture-review--v1.0.0`, `sdd-engineering--v1.0.0` | ❌ Тегів немає взагалі |
| Порядок: спершу залежності, потім `sdd-engineering` | ❌ |
| `claude plugin tag --dry-run` → `--push` | ❌ |
| Перед релізом переглянути CHANGELOG, SHA, результати evals | ❌ Evals не запускались |
| Тег вказує на commit, що пройшов CI | ❌ Немає CI, який валідує плагіни (див. `validate.yml`) |
| `LICENSE` для `next-best-practices`, `fastify-best-practices`; OQ-3 | ❌ Варто закрити до тегу `1.0.0` |

Далі за результатами: встановлення в інший наявний проєкт, `1.1.0`, rollback — нічого з цього ще не робилось.

---

## Фінальна перевірка лабораторної — де ми зараз

| Критерій | Стан | Чим закрити |
|---|---|---|
| Marketplace живе окремо від DevDigest | ✅ | — |
| Contribution, security, releases і cost baseline задокументовані | 🟡 | Є `CONTRIBUTING.md`; додати `SECURITY.md`, `RELEASES.md`; `COST-BASELINE.md` — після прогонів |
| Чотири плагіни мають власні boundaries, owners і versions | 🟡 | Versions ✅, owners у `CODEOWNERS` ✅; boundaries описати в README кожного плагіна (що входить / що ні) і в `PLUGIN-GUIDELINES.md` |
| Dependencies резолвляться без помилок | ✅ | `claude plugin list --json` чистий |
| GitHub Pages показує актуальний каталог із dependencies і README | 🟡 | README ✅, **dependencies ❌** — доробити індексатор і сторінку плагіна |
| `architecture-reviewer` без DevDigest-specific paths | ✅ | Grep чистий |
| `sdd-engineering` використовує namespaced dependencies | ✅ | |
| Validation, behavior evals і negative evals зелені | 🟡 | Validation ✅; evals написані, але не запускались; немає negative-кейсу «нерелевантний запит не вмикає SDD» і немає `validate.yml` у CI |
| `1.0.0` встановлюється в інший наявний проєкт | ⏳ | Після тегів |
| Supporting files і scripts не губляться в plugin cache | ✅ | Перевірено: кількість файлів у кеші = в repo для всіх 4 плагінів; `check-specs.mjs` запускається з кешу |
| Cost experiment: baseline, quality gate, чесний результат | ✅ | `docs/COST-BASELINE.md` — quality gate червоний через модель (DeepSeek часто не викликає агентів), записано чесно |
| Update каталогу та update плагіна перевірені окремо | ⏳ | Описати в `RELEASES.md` зараз, перевірити разом з `1.1.0` |
| Нова поведінка `1.1.0` підтверджена eval | ⏳ | |
| Stable channel повертає `1.0.0`, smoke eval проходить | ❌ / ⏳ | Спосіб каналів (stable = pinned tag / окремий ref) описати в `RELEASES.md` зараз; репетиція — пізніше |

## Відкриті питання

1. **`engineering-insights` і hooks.** Лабораторна перелічує generalized `engineering-insights` у складі `sdd-engineering`. Переносимо (на конфіг `knowledgeFiles`), чи свідомо лишаємо поза `1.0.0` з поясненням у README?
2. **Cost experiment.** Згода на платні прогони і кількість (реалістично 3–5 на версію).
3. **`--strict`** у `validate.mjs`: лишити як додаткову перевірку чи прибрати за лабораторною?
4. **Ruleset на `main`** з review від code owners: увімкнете в GitHub самі, чи зробити через `gh api`?
5. **`LICENSE` і OQ-3** — закрити до тегу `1.0.0`.

## Що доробити зараз (стартові вимоги, без платних прогонів)

1. **Документи:**
   - `docs/PLUGIN-GUIDELINES.md` (з `docs/temp/plugin-authoring-guide.md`, плюс boundaries/owners і dependency rules);
   - `docs/SITE-SPEC.md` (з `docs/temp/catalog-site.md`);
   - `docs/SECURITY.md`;
   - `docs/RELEASES.md` (SemVer, теги `<plugin>--v<version>`, порядок релізу залежностей, update каталогу vs update плагіна, stable channel, rollback);
   - розділ про dependencies у `CONTRIBUTING.md`.
2. **Плагіни:**
   - `COMPATIBILITY.md` × 4 (Claude Code `>=2.1.110`);
   - `$schema` у `marketplace.json`;
   - негативний eval «нерелевантний запит»;
   - рішення щодо `engineering-insights`.
3. **CI:** `.github/workflows/validate.yml` — `node scripts/validate.mjs` на кожен PR.
4. **Сайт:**
   - dependencies (і compatibility) на сторінці плагіна та в індексі;
   - alias `build:index` або пояснення в `site/README.md`.

## Пізніше (крок 8–9 і фінал)

1. Behavior-прогін і evals → `docs/COST-BASELINE.md` → оптимізація → повторний прогін.
2. Теги `1.0.0` у порядку залежностей → встановлення в інший проєкт → smoke.
3. `1.1.0` → eval нової поведінки → оновлення каталогу й плагіна окремо → rollback на stable `1.0.0` → smoke.

---

## Стан після доробки (гілка `feat/lab-start-requirements`)

| Пункт | Стан |
|---|---|
| `docs/PLUGIN-GUIDELINES.md` (перенесено, + розкладка на 4 групи, boundaries/owners, правила dependencies) | ✅ |
| `docs/SITE-SPEC.md` (перенесено) | ✅ |
| `docs/SECURITY.md`, `docs/RELEASES.md` (канали `latest`/`stable`, update vs update, rollback) | ✅ |
| `docs/COST-BASELINE.md` — методика і порожня таблиця | ✅ / прогони ⏳ |
| `CONTRIBUTING.md`: dependencies, документи, повний PR checklist | ✅ |
| `COMPATIBILITY.md` × 4, `$schema` у `marketplace.json` | ✅ |
| `engineering-insights` (узагальнений, у `sdd-engineering`) | ✅ |
| Negative eval `irrelevant-request-no-sdd` | ✅ (не запускався) |
| `.github/workflows/validate.yml` + у `validate.mjs` перевірка absolute paths, secrets, `node --check` | ✅ |
| Сайт: dependencies, «used by», compatibility, пояснення замість `build:index` | ✅ |
| `LICENSE` для `fastify-best-practices` (MIT) | ✅ |
| Джерела 4 скілів знайдено: 3 з `burnjohn/quick-blog`, `next-best-practices` з `vercel-labs/next-skills` — **ліцензій немає** | ❓ потрібен дозвіл авторів або заміна до тегу `1.0.0` |
| `--strict` лишається — він задокументований у CLI reference | ✅ |

## Стан на 2026-10-17 (вечір)

| Пункт здачі | Стан |
|---|---|
| Теги `<plugin>--v1.0.0` (4 шт.), `sdd-engineering--v1.0.1`, `sdd-engineering--v1.1.0` | ✅ |
| `1.1.0`: скіл `/sdd-engineering:sdd-status` (показує активну версію) + eval 3/3 (Sonnet) | ✅ |
| Канал `stable` (гілка) → 1.0.0; репетиція 1.0.0 → 1.1.0 → 1.0.0, smoke eval 3/3 | ✅ `docs/RELEASES.md` §7 rehearsal log |
| Cost per successful workflow до/після | ✅ `docs/COST-BASELINE.md` |
| PR у проєкті з плагіном | ✅ DmytrivDev/FFS#2 |
| Демо-відео | ⏳ записати за сценарієм |
