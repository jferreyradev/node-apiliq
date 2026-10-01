module.exports.jsonParser = {
    novipsst: {
        row: {
            cela: { type: "text", substr: [0, 4] },
            cuil: { type: "text", substr: [4, 11] },
            apeynom: { type: "text", substr: [15, 35] },
            cod: { type: "number", substr: [50, 3] },
            subcod: { type: "number", substr: [53, 3] },
            vto: { type: "text", substr: [56, 6] },
            imp: { type: "number", substr: [68, 11] }
        }
    },
    novhaberes: {},
    novretenciones: {}
};
