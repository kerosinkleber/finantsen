import { getT } from "@/i18n/server";
import { NewGroupForm } from "@/components/NewGroupForm";

export default async function NewGroupPage() {
  const { t } = await getT();
  return (
    <>
      <h1 className="text-xl font-semibold">{t("group.new")}</h1>
      <NewGroupForm />
    </>
  );
}
