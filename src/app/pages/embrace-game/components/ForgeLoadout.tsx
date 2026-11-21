import { ArrowRight, BriefcaseMedical, ChevronDown, Save, Shield, Sparkles, Sword, Swords } from "lucide-react";
import type { FormEventHandler } from "react";
import type { Catalog, GameProfile, Loadout } from "../lib/progression";
import { fighterName } from "./CharacterSelect";
import { fighterAtlasUrl } from "../lib/warriorSelection";
import ForgeItemCard, { ForgeProductArtwork } from "./ForgeItemCard";
import styles from "./forge.module.css";

export default function ForgeLoadout({
  catalog,
  profile,
  draft,
  busy,
  checkingServer,
  onChange,
  onSubmit,
  onChooseFight,
}: {
  catalog: Catalog;
  profile: GameProfile;
  draft: Loadout;
  busy: boolean;
  checkingServer: boolean;
  onChange: (draft: Loadout) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChooseFight?: (changed: boolean) => void;
}) {
  const fields = [
    {
      id: "job",
      label: "Job",
      Icon: Swords,
      options: Object.entries(catalog.jobs).map(([id, job]) => ({ id, label: job.name })),
      detail: catalog.jobs[draft.job]?.description,
    },
    ...(["weapon", "armor"] as const).map((slot) => ({
      id: slot,
      label: slot === "weapon" ? "Weapon" : "Armor",
      Icon: slot === "weapon" ? Sword : Shield,
      options: profile.gear.filter((id) => catalog.gear[id]?.slot === slot).map((id) => {
        const gear = catalog.gear[id];
        const bonus = slot === "weapon" ? gear.attack : gear.armor;
        const stat = slot === "weapon" ? "damage" : "defense";
        return { id, label: bonus === 0 ? gear.name : `${gear.name} · ${bonus > 0 ? "+" : ""}${bonus} ${stat}` };
      }),
    })),
    {
      id: "item",
      label: "Battle item",
      Icon: BriefcaseMedical,
      options: Object.entries(catalog.items).filter(([id]) =>
        id === "bloodleaf_tonic" || id === "ward_stone" || id === draft.item || (profile.items[id] ?? 0) > 0,
      ).map(([id, item]) => ({
        id,
        label: `${item.name} · ${profile.items[id] ?? 0} owned`,
      })),
      detail: catalog.items[draft.item]?.description,
    },
  ] as const;

  const changed = fields.some(({ id }) => draft[id] !== profile.loadout[id]);
  const unlockedSkills = (profile.unlockedSkills ?? []).flatMap((id) => {
    const skill = catalog.skills?.[id];
    return skill ? [{ id, ...skill }] : [];
  });

  return (
    <form onSubmit={onSubmit} className={styles.loadout} aria-labelledby="forge-loadout">
      <h3 id="forge-loadout">Battle loadout</h3>
      <div className={styles.loadoutGrid}>
        {fields.map((field) => {
          const { id, label, Icon, options } = field;
          const detail = "detail" in field ? field.detail : undefined;
          const fieldId = `forge-loadout-${id}`;
          return (
            <div key={id} className={styles.loadoutField}>
              <div className={styles.loadoutArtwork}>
                <ForgeProductArtwork productId={draft[id]} Icon={Icon}
                  portrait={id === "weapon" || id === "armor" ? catalog.gear[draft[id]]?.imageUrl : undefined}
                  effect={id === "item" ? catalog.items[draft.item]?.effect : undefined} />
              </div>
              <label htmlFor={fieldId}><Icon size={18} aria-hidden="true" />{label}</label>
              <div className={styles.selectWrap}>
                <select
                  id={fieldId}
                  value={draft[id]}
                  disabled={busy}
                  aria-describedby={detail ? `${fieldId}-detail` : undefined}
                  onChange={(event) => onChange({ ...draft, [id]: event.target.value })}
                >
                  {!options.length && <option value="">No options available</option>}
                  {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              {detail && <p id={`${fieldId}-detail`}>{detail}</p>}
            </div>
          );
        })}
      </div>
      {unlockedSkills.length > 0 && (
        <section className={styles.shopCategory} aria-labelledby="forge-unlocked-skills">
          <h4 id="forge-unlocked-skills">Unlocked fighter skills</h4>
          <ul role="list" className={styles.shopGrid}>
            {unlockedSkills.map((skill) => (
              <ForgeItemCard key={skill.id} productId={skill.id} name={skill.name} Icon={Sparkles}
                heading="h5" portrait={fighterAtlasUrl(skill.fighter, true)} stat={fighterName(skill.fighter)}
                description={skill.description} />
            ))}
          </ul>
        </section>
      )}
      <div className={styles.loadoutFooter}>
        {changed && <p>Unsaved changes</p>}
        <button type="submit" className={styles.loadoutSave} data-secondary={Boolean(onChooseFight) || undefined} disabled={busy}>
          <Save size={17} aria-hidden="true" />
          {busy && !checkingServer ? "Saving…" : "Save loadout"}
        </button>
        {onChooseFight && (
          <button type="button" className={styles.loadoutSave} disabled={busy} onClick={() => onChooseFight(changed)}>
            {checkingServer ? (
              <span role="status">Connecting to server…</span>
            ) : (
              <>Choose your fight <ArrowRight size={17} aria-hidden="true" /></>
            )}
          </button>
        )}
      </div>
    </form>
  );
}
