-- ====================================================================
-- Script DDL y Procedimientos para la tabla de Catálogo de Vistas/Consultas
-- Compatible con: Oracle 11g (11.2.x), 12c, 19c, 21c, 23c
-- Esquema: US_SUELDO
-- Tabla:   API_VIEW_MAPPER
-- ====================================================================

-- 1. Creación de la Tabla API_VIEW_MAPPER (Compatible con Oracle 11g)
-- Nota: En Oracle 11g NO existe la restricción 'IS JSON' (introducida en 12c),
-- por lo que se define como CLOB estándar con clave primaria y auditoría.
BEGIN
    EXECUTE IMMEDIATE '
        CREATE TABLE API_VIEW_MAPPER (
            VIEW_NAME     VARCHAR2(100) NOT NULL,
            DESCRIPTION   VARCHAR2(255),
            CONFIG_JSON   CLOB NOT NULL,
            IS_ACTIVE     NUMBER(1) DEFAULT 1 NOT NULL,
            CREATED_AT    DATE DEFAULT SYSDATE NOT NULL,
            UPDATED_AT    DATE DEFAULT SYSDATE NOT NULL,
            CONSTRAINT PK_API_VIEW_MAPPER PRIMARY KEY (VIEW_NAME)
        )
    ';
    DBMS_OUTPUT.PUT_LINE('Tabla API_VIEW_MAPPER creada con éxito.');
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE = -955 THEN
            DBMS_OUTPUT.PUT_LINE('La tabla API_VIEW_MAPPER ya existe.');
        ELSE
            RAISE;
        END IF;
END;
/

-- 2. Procedimiento para Crear o Modificar Vistas (Upsert)
-- Compatible con Oracle 11g: utiliza UPDATE + INSERT para máxima estabilidad con CLOBs
CREATE OR REPLACE PROCEDURE SP_UPSERT_VISTA(
    p_view_name     IN VARCHAR2,
    p_description   IN VARCHAR2,
    p_config_json   IN CLOB,
    p_valor_salida  OUT NUMBER,
    p_valor_error   OUT NUMBER,
    p_error_msg     OUT VARCHAR2
) AS
    v_clean_name VARCHAR2(100);
BEGIN
    p_valor_salida := 0;
    p_valor_error  := 0;
    p_error_msg    := NULL;

    v_clean_name := TRIM(p_view_name);

    IF v_clean_name IS NULL THEN
        p_valor_error := 1;
        p_error_msg   := 'El nombre de la vista (p_view_name) es obligatorio.';
        RETURN;
    END IF;

    IF p_config_json IS NULL OR DBMS_LOB.GETLENGTH(p_config_json) = 0 THEN
        p_valor_error := 2;
        p_error_msg   := 'La configuración JSON (p_config_json) es obligatoria.';
        RETURN;
    END IF;

    -- En Oracle 11g, UPDATE con fallback a INSERT es el patrón más seguro con CLOB
    UPDATE API_VIEW_MAPPER
       SET DESCRIPTION = NVL(p_description, DESCRIPTION),
           CONFIG_JSON = p_config_json,
           IS_ACTIVE   = 1,
           UPDATED_AT  = SYSDATE
     WHERE VIEW_NAME   = v_clean_name;

    IF SQL%ROWCOUNT = 0 THEN
        INSERT INTO API_VIEW_MAPPER (
            VIEW_NAME, DESCRIPTION, CONFIG_JSON, IS_ACTIVE, CREATED_AT, UPDATED_AT
        ) VALUES (
            v_clean_name, p_description, p_config_json, 1, SYSDATE, SYSDATE
        );
    END IF;

    p_valor_salida := 1;
EXCEPTION
    WHEN OTHERS THEN
        p_valor_error := SQLCODE;
        p_error_msg   := SUBSTR(SQLERRM, 1, 400);
END SP_UPSERT_VISTA;
/

-- 3. Procedimiento para Desactivar / Eliminar Lógicamente una Vista
CREATE OR REPLACE PROCEDURE SP_ELIMINAR_VISTA(
    p_view_name     IN VARCHAR2,
    p_valor_salida  OUT NUMBER,
    p_valor_error   OUT NUMBER,
    p_error_msg     OUT VARCHAR2
) AS
    v_clean_name VARCHAR2(100);
BEGIN
    p_valor_salida := 0;
    p_valor_error  := 0;
    p_error_msg    := NULL;

    v_clean_name := TRIM(p_view_name);

    IF v_clean_name IS NULL THEN
        p_valor_error := 1;
        p_error_msg   := 'El nombre de la vista (p_view_name) es obligatorio.';
        RETURN;
    END IF;

    UPDATE API_VIEW_MAPPER
       SET IS_ACTIVE = 0,
           UPDATED_AT = SYSDATE
     WHERE VIEW_NAME = v_clean_name;

    IF SQL%ROWCOUNT > 0 THEN
        p_valor_salida := 1;
    ELSE
        p_valor_error := 2;
        p_error_msg   := 'No se encontró la vista especificada para desactivar.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        p_valor_error := SQLCODE;
        p_error_msg   := SUBSTR(SQLERRM, 1, 400);
END SP_ELIMINAR_VISTA;
/
