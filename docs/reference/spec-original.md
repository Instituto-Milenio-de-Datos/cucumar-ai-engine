# Motor de Inteligencia Artificial CuCuMar — especificación original

> Documento fuente del proyecto, con los comentarios de revisión de Hernán Sarmiento incluidos al final de cada sección relevante. Referencia completa: el MVP actual solo cubre los puntos 1-5 (ver `CLAUDE.md` en la raíz del repo para el alcance acordado).

## 1. Caracterización y clasificación del Objeto de Conservación (OC)

El motor de IA deberá identificar y caracterizar el Objeto de Conservación (OC) ingresado, clasificándolo dentro de una categoría de análisis predefinida por CuCuMar. Estas categorías de análisis corresponderán a grupos de Objetos de Conservación que comparten una estructura común de evaluación, tales como mamíferos marinos, aves marinas, hábitats, peces, invertebrados marinos u otras categorías definidas por la plataforma.

La categoría de análisis asignada será la que determinará los criterios y subcriterios que serán utilizados en las etapas posteriores de recopilación, análisis y síntesis de evidencia.

En el caso de aquellos Objetos de Conservación que correspondan a especies, el sistema deberá además identificar y registrar su clasificación taxonómica, incorporando al menos los siguientes niveles jerárquicos: Reino, Filo/División, Clase, Orden, Familia, Género y Especie. Esta información deberá almacenarse en la Tabla_BD o base de datos relacional asociada al proyecto.

**Ejemplo:**
- In: Chungungo
- Out: Categoría de análisis: Mamíferos marinos
- Taxonomía: Reino: Animalia / Filo: Chordata / Clase: Mammalia / Orden: Carnivora / Familia: Mustelidae / Género: Lontra / Especie: *Lontra felina*

> **Comentario (Hernán Sarmiento):** perfecto.
> **Comentario sobre taxonomía (Hernán Sarmiento):** están bien definidas estas descripciones? Es decir, ¿se conocen con claridad previamente?
> **Comentario sobre el ejemplo (Hernán Sarmiento):** para realizar esta clasificación, ¿qué información utilizaría el sistema? ¿Lo que fue almacenado y extraído de los pasos 3 y 4?

## 2. Asignación de criterios y subcriterios de análisis

Una vez clasificado el Objeto de Conservación dentro de una categoría de análisis, el sistema deberá asignar automáticamente las dimensiones, criterios y subcriterios de evaluación definidos por CuCuMar para dicha categoría.

Cada categoría de análisis contará con una estructura propia de evaluación, compuesta por dimensiones, criterios y subcriterios previamente definidos por la plataforma.

El administrador de la plataforma deberá poder crear, modificar o eliminar categorías de análisis, dimensiones, criterios, subcriterios y sus respectivas definiciones.

> **Comentario (Hernán Sarmiento):** perfecto. Para la agregación de estas "reglas", se deberá explicar o "enseñar" a la IA sobre la descripción de lo que se quiere agregar o actualizar.

**Ejemplo — categoría "Mamíferos marinos":**

**Dimensión ecológica**
- Áreas de importancia para la especie
- Distribución y Abundancia
  - Poblaciones pequeñas y residentes
  - Agregaciones
- Aspectos Claves del ciclo de vida
  - Áreas de reproducción
  - Áreas de alimentación
  - Rutas migratorias / movimientos locales
- Aspectos Distintivos
  - Características distintivas
  - Conectividad

**Dimensión Amenazas**
- Cambio Climático
- Pérdida y/o competencia de uso de hábitat
- Especies invasoras
- Uso recurso natural
- Contaminación
- Otras

## 3. Recopilación sistemática de evidencia disponible

El motor de IA deberá realizar una búsqueda y recopilación automatizada de evidencia del OC que sea relevante y se encuentre disponible en internet (Google Académico, Consensus, Scopus, entre otras) para generar un listado en un Excel y/o base de datos relacional.

> **Comentario (Hernán Sarmiento):** perfecto. Mientras se tengan los criterios de búsqueda, no es problema. La plataforma también podría permitir modificarlas en el futuro.

## 4. Sistematización y extracción de metadatos de la evidencia encontrada

Deberá generar un listado completo de evidencia recopilada en Excel y/o base de datos relacional, incorporando metadatos como año de publicación, autores, título, palabras clave, revista de publicación, resumen idioma original, link de descarga.

> **Comentario (Hernán Sarmiento):** esta metadata debería extraerse de manera automática de la base de datos generada, ¿cierto?

## 5. Análisis de cada evidencia y creación de base de datos analítica

Analizar cada evidencia para categorizarla en función de:
- Tipo de publicación (publicación científica, capítulo de libro, informe técnico, conocimiento local, etc.)
- Jerarquizar la evidencia según su robustez para la toma de decisiones (Mupepele, 2016)
- Analizar si genera evidencia basada en área (sí/no)
- Analizar o buscar si es de acceso público o no
- Determinar el área geográfica donde se levantó la evidencia (país, región, comuna)
- Resumen en español

Además, la IA deberá analizar cada evidencia e identificar en una tabla relacional a qué criterios y subcriterios está contribuyendo cada evidencia y deberá registrar la principal contribución que hace.

Se aloja en un Excel o base de datos relacional que acumule los resultados de los puntos 1 a 5, denominado **"1_Tabla_BD"** (ver `docs/reference/1_Tabla_DB.xlsx`).

---

## Puntos 6 en adelante — fuera de alcance del MVP actual

Las siguientes secciones del documento original describen funcionalidad que **no** se construye en este MVP. Se dejan resumidas aquí solo como contexto de hacia dónde podría evolucionar el proyecto, no como especificación a implementar.

### 6. Análisis de la base de datos y síntesis de información

Análisis en 4 niveles (OC general, dimensión, criterio, subcriterio), generando resúmenes, gráficos de evidencia acumulada en el tiempo, gráficos por jerarquía de robustez, y representación geográfica. Se alojaría en "2_Resultados" (gráficos/mapas) y "2.1_Analisis_BD_brechas" (resúmenes + hipervínculos).

### 6b. Identificación de brechas de conocimiento y objetivos de investigación pendientes

Identificación de brechas por criterio/subcriterio (nivel de menor jerarquía), propuesta de objetivos de investigación pendientes, y jerarquización preliminar 1-10 a validar por expertos en talleres. Se aloja en "2.1_Analisis_BD_brechas".

### 7. Sistematización de datos en el Observatorio de la Política Pública

Cálculo automático de indicadores (cantidad, calidad, estado de validación de evidencia; cantidad y prioridad de objetivos de investigación pendientes) para alimentar el Observatorio de Política Pública de CuCuMar, exportados en "3_BD_Observatorio".

### 8. Módulo de validación experta, aprendizaje y mejora continua

Incorporación de observaciones/correcciones de talleres de expertos, registro de cambios distinguiendo propuesta IA vs. versión validada, aprendizaje supervisado, y versionamiento con historial ("Tabla_origen_e_historial").

### 9. End Point — productos disponibles

Dos niveles de información por OC (preliminar IA / validado por expertos), consolidando: 1_Tabla_BD, 2_Resultados, 2.1_Analisis_BD_brechas, 3_Tabla_origen_e_historial.

### 10. Módulo de vigilancia y actualización permanente del conocimiento

Búsquedas periódicas y automatizadas de nueva evidencia para OC ya incorporados, generación de propuestas de modificación preliminares sujetas a validación experta, manteniendo trazabilidad entre contenido generado por IA y contenido validado.

> **Comentario (Hernán Sarmiento) sobre el End Point:** esto no me queda claro a qué se refiere.
> **Comentario (Hernán Sarmiento) sobre validación experta:** preguntar por ejemplo de esto (en reunión).
> **Comentario (Hernán Sarmiento) sobre vigilancia continua:** para entender. Entonces toda la extracción y procesamiento generado por IA, ¿siempre será validado por humanos? ¿Un humano cómo se entera de que hay algo que revisar? ¿Se manejará algún sistema de notificaciones también?