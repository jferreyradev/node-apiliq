const test = require('node:test');
const assert = require('node:assert/strict');
const viewCatalog = require('../services/viewCatalog');

test('viewCatalog administra la caché y resuelve vistas', async (t) => {
    await t.test('obtiene vista existente desde el fallback local si la BD no está disponible', async () => {
        viewCatalog.clearCache();
        const config = await viewCatalog.getViewConfig('configServer');

        assert.ok(config, 'Debe resolver la vista configServer');
        assert.ok(config.fields, 'Debe contener los campos mapeados');
        assert.ok(config.sql.fromClause, 'Debe contener el fromClause');
    });

    await t.test('almacena en memoria RAM la vista consultada', async () => {
        // La consulta anterior debió guardar configServer en la caché
        assert.ok(viewCatalog._viewCache.has('configServer'), 'La caché debe contener configServer');
        const cached = await viewCatalog.getViewConfig('configServer');
        assert.equal(cached, viewCatalog._viewCache.get('configServer'));
    });

    await t.test('retorna null para vistas inexistentes', async () => {
        const noExiste = await viewCatalog.getViewConfig('vistaQueNoExisteEnNingunLado');
        assert.equal(noExiste, null);
    });

    await t.test('getAllViews retorna catálogo completo con fallback', async () => {
        const allViews = await viewCatalog.getAllViews();
        assert.ok(typeof allViews === 'object');
        assert.ok(allViews.configServer);
        assert.ok(allViews.aportesPat);
    });

    await t.test('seedViewsFromFile sincroniza todas las vistas del mapperViews local', async () => {
        const result = await viewCatalog.seedViewsFromFile();
        assert.ok(result.total > 0, 'Debe haber vistas para sincronizar');
        assert.equal(result.successful, result.total, 'Todas las vistas deben procesarse exitosamente');
        assert.equal(result.failed, 0, 'No debe haber fallas');
        assert.ok(viewCatalog._viewCache.has('configServer'), 'Debe estar en la caché RAM');
    });

    await t.test('clearCache vacía la memoria RAM', async () => {
        assert.ok(viewCatalog._viewCache.size > 0);
        viewCatalog.clearCache();
        assert.equal(viewCatalog._viewCache.size, 0);
    });

    await t.test('mapperViews soporta mapperViews.local.json si existe', async () => {
        const fs = require('fs');
        const path = require('path');
        const localPath = path.join(__dirname, '../config/mapperViews.local.json');
        
        try {
            fs.writeFileSync(localPath, JSON.stringify({
                vistaLocalEspecial: {
                    fields: { Campo1: 'c.campo1' },
                    sql: { fromClause: ['FROM tabla_local'] }
                }
            }));

            delete require.cache[require.resolve('../config/mapperViews')];
            const reloaded = require('../config/mapperViews');
            assert.ok(reloaded.jsonViewMap.vistaLocalEspecial, 'Debe haber cargado la vista local');
        } finally {
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
            delete require.cache[require.resolve('../config/mapperViews')];
            require('../config/mapperViews');
        }
    });
});
