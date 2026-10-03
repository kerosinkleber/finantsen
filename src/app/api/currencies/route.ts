import { route } from "@/server/http";
import { getSupportedCurrencies } from "@/server/rates";

export const dynamic = "force-dynamic";
export const GET = route(async () => ({ currencies: await getSupportedCurrencies() }));
