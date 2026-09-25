# API REST SUELDOS ##

## Descripción
    
    API para acceder a tablas de una base de datos relacional oracle para consltas e inserción de registros.

## Instalación
### Requisitos
- Tener instalado node en el sistema. En principio node viene con la herramienta npm.

### Instalación
Descargar la aplicación. Una vez descargada, en el directorio principal ejecutar ```npm install``` . Éste comando instalará todos los paquetes necesarios para el funcionamiento de la aplicación.

### Ejecución
Para lanzar la aplicación se puede realizar con algunos de los siguientes comandos: 
```npm start``` o ```node index.js ``` .

## Conexión

### Punto de entrada:
http://host:3000/api/[entidad]

### Entidad:

    Se puede realizar una petición a cualquier entidad configurada en el archivo ./config/mapper.js

### Ejemplo del contenido de archivo mapper.js:

```
hoja: {
        table: 'hoja_nov',
        fields: {
            FechaGrabacion: 'FECHAALTA',
            TipoCarga: 'IDTIPOCARGA',
            DescripcionTipoCarga: {
                table: 'tabtipocarga',
                parentKey: 'IDTIPOCARGA',
                foringKey: 'IDTIPOCARGA',
                fields: {
                    Descripcion: 'DESCRIPCION'
                }
            },
            EstadoHoja: 'IDESTADOHOJA',
            GrupoAdicional: 'IDGRUPOADI',
            TipoLiquidacion: 'IDTIPOLIQ',
            DescripcionTipoLiquidacion: {
                table: 'tipoliquidacion',
                parentKey: 'IDTIPOLIQ',
                foringKey: 'IDTIPOLIQ',
                fields: {
                    Descripcion: 'DESCRIPCION'
                }
            },
            Periodo: 'PERIODO',
            TipoHoja: 'IDTIPOHOJA',
            Id: 'IDHOJANOV'
        },
        sequence: { field: "Id", seq: 'HOJA_NOV_SEQ.NEXTVAL' }
    },
    tipoliq: {
        table: 'tipoliquidacion',
        fields: {
            Id: 'IDTIPOLIQ',
            Descripcion: 'DESCRIPCION'
        }
    },
    novhaberes: {
        table: 'NOVHABERES',
        fields: {
            NroReparticion: 'IDREP',
            ReparticionDescripcion: {
                table: 'reparticion',
                parentKey: 'IDREP',
                foringKey: 'IDREP',
                fields: {
                    Descripcion: 'DESCRIPCION'
                }
            },
            NroBoleta: 'ORDEN',
            NroAfiliado: 'AFILIADO',
            Codigo: 'CODIGO',
            Subcodigo: 'SUBCOD',
            Clase: 'PARM1',
            Dias: 'PARM2',
            Vencimiento: 'VTO',
            Importe: 'IMPORTE',
            Documento: 'DNI',
            NombreCompleto: 'APYNOM',
            TipoEmpleoId: 'TE',
            TipoEmpleoDescripcion: {
                table: 'tabtipoempleo',
                parentKey: 'TE',
                foringKey: 'IDTE',
                fields: {
                    Descripcion: 'DESCRIPCION'
                }
            },
            SituacionRevistaId: 'SITREV',
            SituacionRevistaDescripcion: {
                table: 'tabsitrevista',
                parentKey: 'SITREV',
                foringKey: 'IDSITREV',
                fields: {
                    Descripcion: 'DESCRIPCION'
                }
            },
            TipoObraSocialId: 'OS',
            PPP: 'PPP',
            FechaGrabacion: 'FECHAGRAB',
            EstadoRegistro: 'IDESTADOREG',
            HojaId: 'IDHOJANOV',
            Id: 'IDNOVHAB'
        },
        sequence: { field: "Id", seq: 'NOVHABERES_SEQ.NEXTVAL' }
    }
```

Ejemplo GET:

http://www.duckdns.org:3000/api/hoja

http://www.duckdns.org:3000/api/tipoliq

---

| Segmento url |Sintaxis|Observación|
| --- |---:| ---:|
| where |?field=value&field=value...| Se puede agregar n condiciones|
| like   | ?search=atributo:texto| Ejemplo: http://localhost:3000/api/persona?search=ApellidoYNombre:FER&limit=5|
| >= o <= | ?greatereq=atrubuto:dd/mm/yyy[&lesseq=atributo:dd/mm/yyyy]| Ejemplo: ?greatereq=Periodo:01/06/2020&lesseq=Periodo:01/11/2020|
|order by | sort={"atributo obj","asc/desc"} |
| limites y corrimiento |&limit=value&offset=value | limit obligatorio, offset opcional |

---


### Ejemplo y pruebas POST:
Las pruebas fueron realizadas con la herramienta curl en linea de comandos.

#### Tipo liquidación:

` curl -X "POST" "http://localhost:3000/api/tipoliq" -i -H 'Content-Type: application/json' -d $'{"Id":"6", "Descripcion":"inc doc"}' `

#### Hoja de novedad:

` curl -X "POST" "http://localhost:3000/api/hoja" -i -H 'Content-Type: application/json' -d $'{"FechaGrabacion":"20-nov-2020", "TipoCarga":"1","EstadoHoja":"1", "GrupoAdicional":"24","TipoLiquidacion":"5","Periodo":"01-dec-2020","TipoHoja":"1"}' `

## Carga de novedades IPSST

La carga de novedades IPSST se realiza en dos pasos. El archivo temporal se identifica mediante un `uploadId` para evitar que dos cargas concurrentes se mezclen.

### 1. Subir el archivo

El cuerpo debe enviarse como archivo binario y el nombre debe estar en el header `x-file-name`:

```bash
curl -X POST "http://localhost:3007/api/fileUpload" \
    -H "Content-Type: text/plain" \
    -H "x-file-name: novedades.txt" \
    --data-binary @novedades.txt
```

La respuesta exitosa es `201` e incluye un identificador único:

```json
{
    "resume": {},
    "rows": [],
    "uploadId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### 2. Procesar la carga

Enviar el `uploadId` recibido en el paso anterior:

```bash
curl -X GET "http://localhost:3007/api/generaNovIPSST?uploadId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

La respuesta exitosa es `201`. El archivo temporal se elimina al finalizar el procesamiento, incluso si ocurre un error en Oracle.

Si falta `uploadId` o no tiene formato válido, la API responde `400`:

```json
{
    "error": "uploadId válido es requerido"
}
```

## Logo de boletas PDF

El logo puede reutilizarse sin modificar el código configurando `LOGO_PATH` en `.env`:

```env
LOGO_PATH=./assets/logo-municipal.png
```

Se admiten archivos `.png`, `.jpg` y `.jpeg`. Si `LOGO_PATH` no está definido, se usan los logos existentes `Logo.png` o `Logo.jpg` según el tipo de boleta.

## Acceso desde el puente Deno

La protección interna está desactivada por defecto para conservar el comportamiento actual. Para exigir que las solicitudes provengan del puente Deno, configurar en `.env`:

```env
REQUIRE_INTERNAL_KEY=true
API_INTERNAL_KEY=una-clave-larga-y-secreta
```

El puente debe enviar esa misma clave en cada solicitud hacia esta API:

```http
X-Internal-Key: una-clave-larga-y-secreta
```

Sin la cabecera correcta, la API responde `403`. Si la protección está activada pero no se configuró la clave, responde `503`. En desarrollo, mantener `REQUIRE_INTERNAL_KEY=false` conserva el acceso local actual.

## Whitelist CORS opcional

La whitelist CORS se activa únicamente cuando se configura `CORS_ORIGINS` en `.env`:

```env
CORS_ORIGINS=https://app.midominio.com,https://admin.midominio.com
```

Si `CORS_ORIGINS` está vacío o ausente, se conserva temporalmente el comportamiento actual de CORS abierto. Las solicitudes sin header `Origin`, como `curl` o llamadas servidor-servidor desde Deno, no se bloquean por CORS.

## HTTPS y certificados

La clave privada y el certificado no forman parte del repositorio. Para iniciar HTTPS, configurar rutas externas en `.env`:

```env
TLS_KEY_PATH=/ruta/segura/server.key
TLS_CERT_PATH=/ruta/segura/server.crt
```

Los archivos deben existir en el entorno de despliegue y no deben versionarse.

## Llamadas a procedimientos y funciones

### Ejemplo de prueba (ejecución en terminal):

    curl -X "GET" "http://localhost:3000/api/fn/verifConcepto?Rep=484&Te=1&Codigo=0&SubCodigo=0&Vto=01-nov-2020" -i -H 'Content-Type: application/json'

### Resultado:
    {"value":1}
