import "server-only";
import crypto from "node:crypto";
import type { AIProvider, ChatMeta, ChatRequest, ChatResponse, ToolCall } from "../../types";
import {
  afterKeyword,
  capitalize,
  extractClientName,
  extractEmail,
  extractPhone,
  norm,
  parseDate,
  parseDelayMinutes,
  parseDuration,
  parseLaborHours,
  parsePricedItems,
  parseRange,
  parseTime,
} from "./parse-fr";

/**
 * Moteur local « hors-ligne ».
 *
 * Il ne remplace pas un vrai modèle de langage : il reconnaît les demandes courantes
 * d'un artisan par des règles, et appelle les MÊMES outils que le LLM. Il permet de
 * faire tourner et de démontrer Jarvis sans clé API. Dès qu'une clé est configurée,
 * AI_PROVIDER=anthropic|openai prend le relais sans autre changement.
 */
export class LocalProvider implements AIProvider {
  readonly id = "local";
  readonly label = "Moteur local (démo)";

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const last = req.messages[req.messages.length - 1];
    if (!last) return { text: HELP_TEXT, toolCalls: [] };

    // Deuxième passage : les outils ont répondu, on restitue leurs résumés (jamais inventés).
    if (last.role === "tool") {
      const summaries: string[] = [];
      for (let i = req.messages.length - 1; i >= 0; i--) {
        const m = req.messages[i]!;
        if (m.role !== "tool") break;
        try {
          // Les cartes affichent déjà le détail : on préfère la version courte quand elle existe.
          const parsed = JSON.parse(m.content) as { summary?: string; headline?: string };
          const text = parsed.headline ?? parsed.summary;
          if (text) summaries.unshift(text);
        } catch {
          summaries.unshift(m.content);
        }
      }
      return { text: summaries.join("\n\n"), toolCalls: [] };
    }

    if (last.role !== "user") return { text: "", toolCalls: [] };
    const call = detectIntent(last.content, req.meta);
    if (typeof call === "string") return { text: call, toolCalls: [] };
    return { text: "", toolCalls: [{ id: `local_${crypto.randomUUID()}`, ...call }] };
  }
}

const HELP_TEXT = [
  "Je peux vous aider pour :",
  "• votre planning — « Qu'est-ce que j'ai demain ? »",
  "• vos rendez-vous — « Ajoute Mme Martin vendredi à 14h pour une fuite »",
  "• vos devis — « Prépare un devis pour M. Bernard : remplacement mitigeur, 1h de main-d'œuvre, mitigeur 95 € »",
  "• vos clients — « Rappelle-moi ce qu'on avait fait chez Dupont »",
  "• vos tâches — « Ajoute une tâche : commander le chauffe-eau de Mme Dupont demain »",
  "• vos préférences — « Note que je ne travaille pas le samedi après-midi »",
  "• vos messages — « Préviens Martin que j'aurai 20 minutes de retard »",
].join("\n");

type Intent = Omit<ToolCall, "id"> | string;

function interventionFrom(text: string, meta: ChatMeta): { label: string; duration: number } | null {
  // Le mot-clé cité en premier l'emporte : « robinet qui goutte » → Robinetterie, pas Recherche de fuite.
  const t = norm(text);
  let best: { label: string; duration: number; pos: number } | null = null;
  for (const it of meta.interventionTypes) {
    for (const k of it.keywords) {
      const pos = t.indexOf(norm(k));
      if (pos >= 0 && (!best || pos < best.pos)) best = { label: it.label, duration: it.defaultDurationMinutes, pos };
    }
  }
  return best && { label: best.label, duration: best.duration };
}

function detectIntent(original: string, meta: ChatMeta): Intent {
  const t = norm(original);
  const today = meta.today;
  const client = extractClientName(original);

  // --- Salutations / aide
  if (/^(bonjour|salut|hello|coucou|bonsoir)[\s!.,]*$/.test(t)) return "Bonjour ! Que puis-je faire pour vous ?\n\n" + HELP_TEXT;
  if (/^(merci|super|parfait|top|ok|d'accord)[\s!.,]*/.test(t) && t.length < 25) return "Avec plaisir ! Autre chose ?";
  if (/(aide|que sais-tu faire|tu sais faire quoi|comment ca marche)/.test(t)) return HELP_TEXT;

  // --- Mémoire : ce que Jarvis sait
  if (/(que sais[- ]tu de moi|ce que tu sais|qu'est-ce que tu sais|tu sais quoi sur moi|tu te souviens de quoi|de quoi tu te souviens|qu'est-ce que tu retiens|ce que tu as retenu|ta memoire|mes regles|mes preferences|mes tarifs|mon tarif|quel est mon taux)/.test(t)) {
    const query = /tarif|taux/.test(t) ? "tarif" : /regle/.test(t) ? "" : "";
    return { name: "searchMemory", args: query ? { query } : {} };
  }

  // --- Mémoire : enregistrer
  const memoryContent = afterKeyword(original, [
    /\b(?:note|notez|retiens|retenez|souviens[- ]toi|rappelle[- ]toi|n'oublie pas|enregistre|m[ée]morise)\s+(?:bien\s+)?(?:que|qu')\s*/i,
    /^(?:note|retiens|m[ée]morise)\s*:\s*/i,
  ]);
  if (memoryContent && !/\btache\b/.test(t)) {
    const c = norm(memoryContent);
    let category = "FACT";
    if (/(cette semaine|ce mois-ci|jusqu'a|aujourd'hui|demain|exceptionnellement)/.test(c)) category = "TEMPORARY";
    else if (/(jamais|toujours|\bne\b.*\b(pas|plus)\b|\bpas de\b|aucun|interdit|maximum|minimum|au plus)/.test(c)) category = "RULE";
    else if (/(prefere|j'aime|plutot|de preference)/.test(c)) category = "PREFERENCE";
    else if (/(tarif|€|euros|factur|horaire|zone|siret)/.test(c)) category = "BUSINESS_INFO";
    const content = capitalize(memoryContent.replace(/^j'/i, "J'").replace(/^je\b/i, "Je"));
    return { name: "addMemory", args: { content: /[.!?]$/.test(content) ? content : `${content}.`, category } };
  }

  // --- Tâches
  const taskText = afterKeyword(original, [
    /\b(?:ajoute|cr[ée]e|mets|note)[- ]?(?:moi)?\s+(?:une\s+)?t[âa]che\s*(?::|de|pour|qui consiste a)?\s*/i,
    /\brappelle[- ]moi\s+(?:de|d')\s*/i,
    /\bpense\s+(?:à|a)\s*/i,
    /\bil faut que je\s*/i,
  ]);
  if (taskText) {
    const due = parseDate(original, today);
    const title = capitalize(
      taskText
        .replace(/\b(demain|aujourd'hui|après-demain|apres-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain)?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    return {
      name: "createTask",
      args: { title, ...(due ? { dueDate: due } : {}), ...(/(urgent|important|priorit)/.test(t) ? { priority: "high" } : {}), ...(client ? { client } : {}) },
    };
  }
  // --- Messages clients
  if (/\b(sms|texto|message|previens|prevenir|previens|avertis|avertir|ecris a|ecrire a|mail a|email a|relance)\b/.test(t) && !/\bdevis\b.*\b(prepare|fais|cree)\b/.test(t)) {
    const delay = parseDelayMinutes(original);
    const purpose = /retard/.test(t) ? "delay" : /devis/.test(t) ? "quote_followup" : /(rappel|demain|confirm)/.test(t) ? "reminder" : "custom";
    const channel = /(mail|email|e-mail)/.test(t) ? "email" : "sms";
    const target = /(prochain client|prochaine intervention|prochain rendez|client suivant)/.test(t) ? "next_appointment" : undefined;
    const instructions = afterKeyword(original, [/\b(?:que|qu')\s*/i]);
    return {
      name: "draftCustomerMessage",
      args: {
        ...(target ? { target } : client ? { client } : { target: "next_appointment" }),
        channel,
        purpose,
        ...(delay ? { delayMinutes: delay } : {}),
        ...(instructions && purpose === "custom" ? { instructions } : {}),
      },
    };
  }

  // --- Devis
  if (/\bdevis\b/.test(t)) {
    if (/\b(envoie|envoyer|envoyez|transmets)\b/.test(t)) {
      const num = original.match(/D-\d{4}-\d+/i)?.[0];
      return { name: "sendQuote", args: num ? { quoteNumber: num.toUpperCase() } : client ? { client } : {} };
    }
    if (/\b(prepare|preparer|prepare-moi|fais|faire|cree|creer|redige|etablis|nouveau|chiffre)\b/.test(t)) {
      const segment = afterKeyword(original, [/:\s*/]) ?? afterKeyword(original, [/\bpour\s+(?=(?:remplacer|remplacement|installer|installation|poser|pose|reparer|réparer|réparation|reparation|changer|changement|deboucher|déboucher)\b)/i]);
      const tmpl = meta.quoteTemplates.find((q) => q.keywords.some((k) => t.includes(norm(k))));
      const title = segment ? capitalize(segment.split(",")[0]!.trim()) : (tmpl?.label ?? "Intervention");
      const priced = parsePricedItems(original);
      const materials = priced.length > 0 ? priced.map((p) => ({ label: p.label, quantity: 1, unitPrice: p.price })) : (tmpl?.materials.map((m) => ({ label: m.label, quantity: 1, unitPrice: m.unitPrice })) ?? []);
      const laborHours = parseLaborHours(original) ?? tmpl?.laborHours ?? 1;
      return {
        name: "createQuoteDraft",
        args: {
          ...(client ? { client } : {}),
          title,
          laborHours,
          materials,
          includeTravel: !/sans deplacement/.test(t),
          ...(priced.length === 0 && tmpl ? { notes: "Prix du matériel issus du modèle de devis : à vérifier." } : {}),
        },
      };
    }
    const status = /(attente|sans reponse|envoyes?)/.test(t) ? "sent" : /brouillon/.test(t) ? "draft" : /accepte/.test(t) ? "accepted" : undefined;
    return { name: "listQuotes", args: status ? { status } : {} };
  }

  // --- Historique client (avant les tâches : « rappelle-moi ce qu'on avait fait… »)
  if (/(on avait fait|on a fait|qu'est-ce qu'on a|historique|derniere intervention|dernier passage|deja fait|deja venu|quand suis-je passe)/.test(t) && client) {
    return { name: "getClientHistory", args: { client } };
  }

  if (/\b(taches|a faire|todo)\b/.test(t) || /\b(je dois|dois-je|j'ai a|il me reste a) faire\b/.test(t)) {
    const scope = /(retard)/.test(t) ? "overdue" : /(aujourd'hui|du jour)/.test(t) ? "today" : "all";
    return { name: "listTasks", args: { scope } };
  }

  // --- Rendez-vous : modifier / annuler
  if (/\b(deplace|decale|reporte|avance|change|modifie|annule|annuler|deplacer|decaler|reporter)\b/.test(t) && (client || /rendez|rdv|intervention/.test(t))) {
    const isCancel = /\bannul/.test(t);
    const parts = original.split(/(?<=^|\s)(?:à|a|au|vers|pour)(?=\s+(?:demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d))/i);
    const target = parts.length > 1 ? parts.slice(1).join(" ") : original;
    const newDate = isCancel ? null : parseDate(target, today);
    const newTime = isCancel ? null : parseTime(target);
    return {
      name: "updateAppointment",
      args: {
        ...(client ? { client } : {}),
        ...(isCancel ? { status: "cancelled" } : {}),
        ...(newDate ? { newDate } : {}),
        ...(newTime ? { newTime } : {}),
      },
    };
  }

  // --- Rendez-vous : créer
  const date = parseDate(original, today);
  const time = parseTime(original);
  if (/\b(ajoute|ajouter|planifie|programme|cale|caler|mets|reserve|bloque|prends|rdv|rendez-vous|nouvelle intervention|passe chez|passer chez)\b/.test(t) && (date || time) && client) {
    const it = interventionFrom(original, meta);
    const duration = parseDuration(original) ?? it?.duration ?? 60;
    if (!date) return `Pour quel jour dois-je prévoir ${client} ?`;
    if (!time) return { name: "getCalendarAvailability", args: { date, durationMinutes: duration } };
    return {
      name: "createAppointment",
      args: { client, date, time, durationMinutes: duration, interventionType: it?.label ?? "Intervention" },
    };
  }

  // --- Disponibilités
  if (/(dispo|libre|creneau|trou)/.test(t)) {
    const afternoon = /(apres-midi|apres midi|aprem|cet aprem|l'aprem)/.test(t);
    const morning = !afternoon && /\b(matin|matinee)\b/.test(t);
    return { name: "getCalendarAvailability", args: { date: date ?? today, ...(afternoon ? { after: "12:00" } : morning ? { before: "12:00" } : {}) } };
  }

  // --- Planning
  if (/(qu'est-ce que j'ai|qu'ai-je|j'ai quoi|planning|agenda|programme|mes rendez|mes interventions|mes rdv|ma journee|ma semaine|on a quoi)/.test(t)) {
    const range = parseRange(original, today);
    if (range) return { name: "getAppointments", args: { from: range.from, to: range.to } };
    return { name: "getAppointments", args: { date: date ?? today } };
  }

  // --- Clients : créer
  if (/(nouveau client|nouvelle cliente|cree (le |un |une )?client|ajoute (le |un |une )?client)/.test(t)) {
    const nameMatch = original.match(/client(?:e)?\s*:?\s*(Mme|Madame|M\.|Monsieur)?\s*([A-ZÀ-Ý][\wÀ-ÿ'-]+)(?:\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+))?/);
    if (!nameMatch) return "Quel est le nom du nouveau client ? Par exemple : « Nouveau client : Mme Claire Petit, 06 11 22 33 44, à Talence ».";
    const civility = nameMatch[1] ? (/^m(\.|onsieur)/i.test(nameMatch[1]) ? "M." : "Mme") : undefined;
    const firstName = nameMatch[3] ? nameMatch[2] : undefined;
    const lastName = nameMatch[3] ?? nameMatch[2]!;
    const city = original.match(/(?:^|\s)(?:à|a)\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:[- ][A-ZÀ-Ý][\wÀ-ÿ'-]+)*)/)?.[1];
    const address = original
      .match(/\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|allée|allee|place|impasse|route|cours|quai|lotissement|résidence|residence)\b[^,;\n]*/i)?.[0]
      .replace(/\s+(?:à|a)\s+[A-ZÀ-Ý].*$/, "")
      .trim();
    return {
      name: "createClient",
      args: {
        lastName,
        ...(firstName ? { firstName } : {}),
        ...(civility ? { civility } : {}),
        ...(extractPhone(original) ? { phone: extractPhone(original) } : {}),
        ...(extractEmail(original) ? { email: extractEmail(original) } : {}),
        ...(address ? { address } : {}),
        ...(city ? { city } : {}),
      },
    };
  }

  // --- Clients : rechercher
  if (client && /(numero|telephone|tel\b|adresse|mail|coordonnees|cherche|trouve|fiche|infos?|qui est|client|habite)/.test(t)) {
    return { name: "searchClient", args: { query: client } };
  }
  if (client && t.split(/\s+/).length <= 3) return { name: "searchClient", args: { query: client } };

  return "Je n'ai pas bien compris votre demande.\n\n" + HELP_TEXT;
}
