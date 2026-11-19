export type EnemySprite = "echo-beast" | "gate-warden" | "hollow-specter";

export function enemySpriteFor(name: string): EnemySprite {
  if (/beast|drake|hunter|wolf/i.test(name)) return "echo-beast";
  if (/warden|knight|sentinel|guard/i.test(name)) return "gate-warden";
  return "hollow-specter";
}

export function enemyAtlasUrl(enemy: EnemySprite) {
  return `/sprite/combat/enemy-${enemy}.webp`;
}
