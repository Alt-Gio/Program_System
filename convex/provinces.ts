import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("provinces").collect(),
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) =>
    ctx.db.query("provinces").withIndex("by_code", (q) => q.eq("code", args.code)).first(),
});

export const lgusByProvince = query({
  args: { provinceId: v.id("provinces") },
  handler: async (ctx, args) =>
    ctx.db.query("lgus").withIndex("by_province", (q) => q.eq("provinceId", args.provinceId)).collect(),
});

export const allLGUs = query({
  args: {},
  handler: async (ctx) => ctx.db.query("lgus").collect(),
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("provinces").collect();
    if (existing.length > 0) return { seeded: false, count: existing.length };

    const provincesData = [
      { name: "Albay", code: "ALB", region: "Region V", coordinates: { lat: 13.1775, lng: 123.6279 }, isActive: true },
      { name: "Camarines Norte", code: "CAN", region: "Region V", coordinates: { lat: 14.1389, lng: 122.7632 }, isActive: true },
      { name: "Camarines Sur", code: "CAS", region: "Region V", coordinates: { lat: 13.6252, lng: 123.1855 }, isActive: true },
      { name: "Catanduanes", code: "CAT", region: "Region V", coordinates: { lat: 13.7089, lng: 124.2422 }, isActive: true },
      { name: "Masbate", code: "MAS", region: "Region V", coordinates: { lat: 12.3696, lng: 123.6158 }, isActive: true },
      { name: "Sorsogon", code: "SOR", region: "Region V", coordinates: { lat: 12.9735, lng: 124.0037 }, isActive: true },
    ];

    const provinceIds: Record<string, string> = {};
    for (const p of provincesData) {
      const id = await ctx.db.insert("provinces", p);
      provinceIds[p.code] = id;
    }

    const lgusData = [
      { name: "Legazpi City", provinceCode: "ALB", type: "City", coordinates: { lat: 13.1391, lng: 123.7438 } },
      { name: "Ligao City", provinceCode: "ALB", type: "City", coordinates: { lat: 13.2263, lng: 123.5247 } },
      { name: "Tabaco City", provinceCode: "ALB", type: "City", coordinates: { lat: 13.3594, lng: 123.7330 } },
      { name: "Daraga", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.1584, lng: 123.7058 } },
      { name: "Guinobatan", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.1871, lng: 123.5913 } },
      { name: "Camalig", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.1784, lng: 123.6508 } },
      { name: "Oas", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.2557, lng: 123.5004 } },
      { name: "Polangui", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.2910, lng: 123.4866 } },
      { name: "Tiwi", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.4557, lng: 123.6861 } },
      { name: "Sto. Domingo", provinceCode: "ALB", type: "Municipality", coordinates: { lat: 13.1056, lng: 124.0094 } },
      { name: "Daet", provinceCode: "CAN", type: "Municipality", coordinates: { lat: 14.1028, lng: 122.9533 } },
      { name: "Labo", provinceCode: "CAN", type: "Municipality", coordinates: { lat: 14.1583, lng: 122.8230 } },
      { name: "Jose Panganiban", provinceCode: "CAN", type: "Municipality", coordinates: { lat: 14.2971, lng: 122.9841 } },
      { name: "Mercedes", provinceCode: "CAN", type: "Municipality", coordinates: { lat: 14.1092, lng: 123.0150 } },
      { name: "Vinzons", provinceCode: "CAN", type: "Municipality", coordinates: { lat: 14.1697, lng: 122.9099 } },
      { name: "Talisay", provinceCode: "CAN", type: "Municipality", coordinates: { lat: 14.1326, lng: 122.9238 } },
      { name: "Naga City", provinceCode: "CAS", type: "City", coordinates: { lat: 13.6192, lng: 123.1814 } },
      { name: "Iriga City", provinceCode: "CAS", type: "City", coordinates: { lat: 13.4235, lng: 123.4112 } },
      { name: "Pili", provinceCode: "CAS", type: "Municipality", coordinates: { lat: 13.5759, lng: 123.2810 } },
      { name: "Calabanga", provinceCode: "CAS", type: "Municipality", coordinates: { lat: 13.7048, lng: 123.2216 } },
      { name: "Milaor", provinceCode: "CAS", type: "Municipality", coordinates: { lat: 13.6023, lng: 123.1637 } },
      { name: "Canaman", provinceCode: "CAS", type: "Municipality", coordinates: { lat: 13.6260, lng: 123.1718 } },
      { name: "Bombon", provinceCode: "CAS", type: "Municipality", coordinates: { lat: 13.5563, lng: 123.2018 } },
      { name: "Tigaon", provinceCode: "CAS", type: "Municipality", coordinates: { lat: 13.6352, lng: 123.4958 } },
      { name: "Virac", provinceCode: "CAT", type: "Municipality", coordinates: { lat: 13.5786, lng: 124.2340 } },
      { name: "Bato", provinceCode: "CAT", type: "Municipality", coordinates: { lat: 13.3594, lng: 124.3075 } },
      { name: "Gigmoto", provinceCode: "CAT", type: "Municipality", coordinates: { lat: 13.7726, lng: 124.3849 } },
      { name: "Pandan", provinceCode: "CAT", type: "Municipality", coordinates: { lat: 14.0461, lng: 124.1679 } },
      { name: "San Andres", provinceCode: "CAT", type: "Municipality", coordinates: { lat: 13.4979, lng: 124.1156 } },
      { name: "Viga", provinceCode: "CAT", type: "Municipality", coordinates: { lat: 13.8552, lng: 124.3791 } },
      { name: "Masbate City", provinceCode: "MAS", type: "City", coordinates: { lat: 12.3686, lng: 123.6196 } },
      { name: "Aroroy", provinceCode: "MAS", type: "Municipality", coordinates: { lat: 12.5116, lng: 123.3965 } },
      { name: "Milagros", provinceCode: "MAS", type: "Municipality", coordinates: { lat: 12.2280, lng: 123.5068 } },
      { name: "Mobo", provinceCode: "MAS", type: "Municipality", coordinates: { lat: 12.3368, lng: 123.3895 } },
      { name: "Claveria", provinceCode: "MAS", type: "Municipality", coordinates: { lat: 12.0063, lng: 123.2283 } },
      { name: "Pio V. Corpuz", provinceCode: "MAS", type: "Municipality", coordinates: { lat: 12.5551, lng: 123.5490 } },
      { name: "Sorsogon City", provinceCode: "SOR", type: "City", coordinates: { lat: 12.9750, lng: 124.0047 } },
      { name: "Bulan", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.6677, lng: 123.8748 } },
      { name: "Bulusan", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.7538, lng: 124.1306 } },
      { name: "Donsol", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.9074, lng: 123.5958 } },
      { name: "Gubat", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.9218, lng: 124.1157 } },
      { name: "Irosin", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.7044, lng: 124.0265 } },
      { name: "Juban", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.8444, lng: 123.9972 } },
      { name: "Magallanes", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.8295, lng: 123.8382 } },
      { name: "Pilar", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.9261, lng: 123.6703 } },
      { name: "Sta. Magdalena", provinceCode: "SOR", type: "Municipality", coordinates: { lat: 12.6564, lng: 124.0954 } },
    ];

    for (const lgu of lgusData) {
      const provId = provinceIds[lgu.provinceCode];
      if (provId) {
        await ctx.db.insert("lgus", {
          name: lgu.name, type: lgu.type,
          provinceId: provId as any,
          coordinates: lgu.coordinates,
          isActive: true,
        });
      }
    }

    return { seeded: true, provinces: provincesData.length, lgus: lgusData.length };
  },
});
