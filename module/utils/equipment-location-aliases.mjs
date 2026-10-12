const ENGLISH_LOCATION_NAMES = {
  "Crânio": "Skull", "Olhos": "Eyes", "Rosto": "Face", "Pescoço": "Neck", "Tronco": "Torso",
  "Órg. vitais": "Vitals", "Virilha": "Groin", "Braço": "Arm", "Mão": "Hand", "Perna": "Leg",
  "Pé": "Foot", "Cauda": "Tail", "Asa": "Wing", "Tentáculo": "Tentacle", "Pinça": "Pincer",
  "Nadadeira": "Fin", "Pata": "Paw", "Corpo": "Body", "Ombro": "Shoulder", "Peito": "Chest",
  "Abdômen": "Abdomen", "Articulação": "Joint", "Coluna": "Spine", "Artéria": "Artery",
  "Mandíbula": "Jaw", "Chifre": "Horn", "Nariz": "Nose", "Orelha": "Ear"
};

const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function englishEquipmentLocationName(name) {
  const match = String(name || "").match(/^(ex-)?(.+?)(?:\s+([ED])(\d+)|\s+(\d+))?$/);
  if (!match) return name;
  const root = Object.entries(ENGLISH_LOCATION_NAMES)
    .find(([portuguese]) => normalize(portuguese) === normalize(match[2]))?.[1];
  if (!root) return name;
  const side = match[3] === "E" ? " L" : match[3] === "D" ? " R" : "";
  const number = match[4] || match[5] || "";
  return `${match[1] ? "Extra " : ""}${root}${side}${number ? (side ? number : ` ${number}`) : ""}`;
}

export function bilingualLocationOptions(originalOptions, displayOptions, language) {
  const isEnglish = String(language || "").startsWith("en");
  const aliases = originalOptions
    .map((option, index) => ({
      id: option.id,
      name: isEnglish ? option.name : englishEquipmentLocationName(option.name),
      displayName: displayOptions[index]?.name
    }))
    .filter(option => option.name !== option.displayName)
    .map(({ id, name }) => ({ id, name }));
  return displayOptions.concat(aliases);
}
