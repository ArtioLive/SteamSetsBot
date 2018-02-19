module.exports = {
    USERNAME: "",
    PASSWORD: "",
    SHAREDSECRET: "",
    IDENTITYSECRET: "",
    STEAMAPIKEY: "",
    INVITETOGROUPID: "",
    db: {
        username: "",
        password: "",
        host: "",
        collection: ""
    },
    // PLAYGAMES: [509840], // List of appid's/names. Names will be played as non steam games. First game entered will show on profile, others will be idled in the background.
    PLAYGAMES: ["", 0, 440], // List of appid's/names. Names will be played as non steam games. First game entered will show on profile, others will be idled in the background.
    COMMENTAFTERTRADE: "",
    MAXHOURSADDED: 168, // The bot will remove users after 24 hours (1 week) of inactivity.
    OWNERLINK: "",
    CREDITS: "",
    ADMINS: [
        ""
    ],
    CSGOGAME: 730,
    TFGAME: 440,
    STEAMGAME: 753,
    PUBGGAME: 578080,
    MAXMSGPERSEC: 10, // The amount of messages users can send every second without getting removed.
    CARDS: {
        CSGO: {
            buy_sets_by_one: 14, //Key
            give_one_for: 18, //Sets
            MAXSETSELL: 500,
            PEOPLETHATCANSELL: []
        },
        TF2: {
            buy_sets_by_one: 12, //Key
            give_one_for: 15, //Sets
            MAXSETSELL: 500,
            PEOPLETHATCANSELL: []
        },
        GEMS: {
            buy_one_set_for: 350, //Gems
            give_one_set_for: 200, //Gems
            MAXSETSELL: 500000,
            PEOPLETHATCANSELL: []
        },
        PUBG: {
            buy_sets_by_one: 14, //Key
            give_one_for: 16, //Sets
            MAXSETSELL: 500,
            PEOPLETHATCANSELL: []
        },
    },
    PROFILE: {
        NAME: ""
    },
    MESSAGES: {
        WELCOME: "Hello!",
        CMD_NOT_RECOGNIZED: "Command not recognized. Use !help to see how this bot works.",
        MAXLEVEL: 1337, // Max level you can request using !level
        MAXBUY: 100, // Max keys you can buy sets for at a time
        MAXBUYGEMS: 500000,
        MAXSELL: 500, // Max keys you can sell sets for at a time
    },
    ACCEPTEDKEYS: [
        "Chroma 2 Case Key",
        "Spectrum Case Key",
        "Huntsman Case Key",
        "Chroma Case Key",
        "eSports Key",
        "Winter Offensive Case Key",
        "Revolver Case Key",
        "Operation Vanguard Case Key",
        "Shadow Case Key",
        "Operation Wildfire Case Key",
        "Falchion Case Key",
        "Operation Breakout Case Key",
        "Chroma 3 Case Key",
        //"CS:GO Case Key",
        "Operation Phoenix Case Key",
        "Gamma Case Key",
        "Gamma 2 Case Key",
        "Glove Case Key",
        "Operation Hydra Case Key"
    ],
    TFACCEPTEDKEYS: [
        "Mann Co. Supply Crate Key"
    ],
    PUBGACCEPTEDKEYS: [
        "THE FIRST KEY",
        "GAMESCOM INVITATIONAL KEY",
        "EARLY BIRD KEY",
        "2 EARLY BIRD KEY",
        "3 EARLY BIRD KEY",
        "4 EARLY BIRD KEY",
        "5 EARLY BIRD KEY",
        "7 EARLY BIRD KEY",
        "8 EARLY BIRD KEY",
        "9 EARLY BIRD KEY"
    ],
    STEAMGEMS: [
        "753-Gems"
    ]
};
