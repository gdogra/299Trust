// Plan catalog. `id` matches the DB CHECK constraints and the Formstack `plan`
// hidden field exactly — do not change one without the others.

export type PlanId = "individual_299" | "joint_399";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  priceCents: number;
  tagline: string;
  forWho: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "individual_299",
    name: "Individual Trust",
    price: "$299",
    priceCents: 29900,
    tagline: "A complete revocable living trust for one person.",
    forWho: "For individuals",
    features: [
      "Revocable living trust",
      "Pour-over will",
      "Financial power of attorney",
      "Healthcare directive",
    ],
  },
  {
    id: "joint_399",
    name: "Joint Trust",
    price: "$399",
    priceCents: 39900,
    tagline: "One shared trust for couples and partners.",
    forWho: "For couples",
    features: [
      "Joint revocable living trust",
      "Two pour-over wills",
      "Two powers of attorney",
      "Two healthcare directives",
    ],
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!;
