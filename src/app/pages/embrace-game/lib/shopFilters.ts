export const SHOP_CATEGORIES = {
  all: "All categories",
  skills: "Companion skills",
  weapons: "Weapons",
  armor: "Armor",
  items: "Battle items",
  fighters: "Fighters",
  upgrades: "Upgrades",
  currency: "Cinder bundles",
} as const;

export type ShopCategory = keyof typeof SHOP_CATEGORIES;
export type ShopFilters = {
  category: ShopCategory;
  payment: "all" | "cinders" | "cash";
  ownership: "all" | "unowned" | "owned";
  query: string;
};

export function matchesShopFilters(filters: ShopFilters, category: ShopCategory, owned: boolean, ...terms: (string | undefined)[]) {
  return (filters.category === "all" || filters.category === category) &&
    (filters.ownership === "all" || (filters.ownership === "owned") === owned) &&
    terms.join(" ").toLowerCase().includes(filters.query.trim().toLowerCase());
}
