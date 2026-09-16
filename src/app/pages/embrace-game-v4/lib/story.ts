export const story = {
  start: {
    id: "start",
    title: "THE GATE OF ASH",
    text: "The four teams awaken beneath a ruined cathedral. Something beneath the earth is calling their names.",
    image: "/highlands.jpeg",
    choices: [
      {
        id: "enter",
        text: "Enter the cathedral",
        result: "safe",
        next: "cathedral",
      },
      {
        id: "forest",
        text: "Enter the dark forest",
        result: "random",
        encounter: "forest_wraith",
      },
      {
        id: "altar",
        text: "Touch the ancient altar",
        result: "battle",
        battle: "altar_guardian",
      },
    ],
  },

  cathedral: {
    id: "cathedral",
    title: "THE SILENT CATHEDRAL",
    text: "The doors close behind you. A voice whispers from somewhere above.",
    image: "/nacos.jpg",
    choices: [
      {
        id: "stairs",
        text: "Climb the stairs",
        result: "safe",
        next: "tower",
      },
      {
        id: "crypt",
        text: "Descend into the crypt",
        result: "battle",
        battle: "crypt_guardian",
      },
    ],
  },

  tower: {
    id: "tower",
    title: "THE WATCHER",
    text: "At the top of the tower stands a figure staring directly at your team.",
    image: "/dark-forest.jpeg",
    choices: [
      {
        id: "approach",
        text: "Approach the watcher",
        result: "safe",
        next: "final_gate",
      },
      {
        id: "attack",
        text: "Attack immediately",
        result: "battle",
        battle: "watcher",
      },
    ],
  },

  final_gate: {
    id: "final_gate",
    title: "THE FINAL GATE",
    text: "Only the surviving teams remain. The final gate begins to open.",
    image: "/uj.jpeg",
    choices: [
      {
        id: "open",
        text: "Open the gate",
        result: "battle",
        battle: "final_battle",
      },
    ],
  },
};
