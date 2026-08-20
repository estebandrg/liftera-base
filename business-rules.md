Liftera registra lo que hiciste
→ interpreta tu rendimiento
→ detecta tendencias
→ decide qué deberías hacer después
→ aprende de la respuesta.

# Lógica de negocio de Liftera

Liftera debe convertir los datos de entrenamiento del usuario en decisiones útiles para mejorar su progresión. No se trata solamente de registrar peso, repeticiones y series, sino de interpretar el rendimiento y recomendar qué hacer a continuación.

### 1. Progresión automática

Para cada ejercicio, Liftera debe determinar cuándo conviene aumentar carga, aumentar repeticiones, mantener el peso o reducirlo.

La decisión debe considerar el rendimiento reciente, rango de repeticiones objetivo, RIR/RPE y tendencia histórica.

Ejemplo: si el usuario alcanza repetidamente el límite superior del rango con un RIR adecuado, Liftera recomienda aumentar la carga.

### 2. Detección de estancamiento

Liftera debe detectar cuándo un ejercicio dejó de progresar.

No debe considerar únicamente si el peso aumentó. También debe analizar repeticiones, RIR/RPE y rendimiento de las últimas sesiones.

Debe distinguir entre:

- estancamiento real;
- fatiga temporal;
- rendimiento estable;
- regresión.

### 3. Análisis de fatiga

Liftera debe identificar señales de fatiga o exceso de carga de entrenamiento a partir de caídas de rendimiento, aumento del esfuerzo percibido, volumen reciente y frecuencia de entrenamiento.

La fatiga debe funcionar como una señal para modificar recomendaciones, no como un diagnóstico médico.

### 4. Gestión del volumen

Liftera debe analizar el volumen por ejercicio y grupo muscular, relacionándolo con el rendimiento.

No debe asumir que más volumen siempre es mejor. Debe detectar cuándo aumentar volumen parece beneficiar al usuario y cuándo un aumento de volumen coincide con una caída de rendimiento.

### 5. Detección de progreso real

El progreso no debe depender únicamente de subir kilos.

Liftera debe detectar:

- PR de peso;
- PR de repeticiones;
- PR de volumen;
- mejora del 1RM estimado;
- mejora dentro de un rango de repeticiones;
- tendencia positiva de rendimiento.

Esto permite reconocer progreso incluso cuando la carga no aumenta.

### 6. Análisis de patrones

Liftera debe analizar ejercicios relacionados y no únicamente cada ejercicio de manera aislada.

Por ejemplo, una mejora consistente en press inclinado y chest press puede indicar una mejora general del patrón de empuje aunque el press banca no haya progresado.

### 7. Recomendación de la próxima sesión

El objetivo final del sistema es poder responder:

**"¿Qué debería hacer la próxima vez?"**

La recomendación puede ser:

- aumentar carga;
- aumentar repeticiones;
- mantener carga;
- reducir carga;
- reducir volumen;
- mantener volumen;
- modificar el rango de repeticiones;
- evaluar un cambio de ejercicio;
- mantener el plan porque la progresión es adecuada.

### 8. Explicabilidad

Toda recomendación importante debe tener una razón comprensible.

Por ejemplo:

> "Aumentá 2,5 kg. Alcanzaste el máximo del rango durante las últimas dos sesiones y tu rendimiento se mantiene estable."

El usuario debe poder entender por qué Liftera tomó una decisión.

### 9. Nivel de confianza

Las recomendaciones no siempre tendrán la misma certeza.

Liftera debe poder representar qué tan sólida es una recomendación según la cantidad y calidad de datos disponibles.

Una recomendación basada en cuatro semanas de rendimiento consistente debería tener mayor confianza que una basada solamente en una sesión.

### 10. Adaptación al usuario

Liftera debe aprender progresivamente cómo responde cada usuario.

Puede detectar patrones como:

- rangos de repeticiones donde progresa mejor;
- tolerancia al volumen;
- velocidad de progresión;
- frecuencia con la que aparece fatiga;
- respuesta a determinados ejercicios.

Con suficiente historial, las recomendaciones deben pasar de reglas generales a decisiones cada vez más personalizadas.

### Principio central

Liftera debe funcionar como un ciclo:

**registrar → interpretar → decidir → aplicar → observar el resultado → volver a ajustar.**

La meta no es decirle al usuario solamente qué hizo, sino determinar qué significa lo que hizo y utilizarlo para tomar una mejor decisión en el siguiente entrenamiento.

### Principio arquitectónico: el motor decide, la IA coacha

Liftera es un coach IA. La interfaz principal entre el usuario y la inteligencia del sistema es una **conversación con la IA**, no cards estáticas con templates. Este principio es explícito y vinculante para todo el sistema:

- **La IA (LLM) es la cara del producto.** Conversa, explica y adapta el mensaje al contexto cualitativo del usuario (sueño, estrés, motivación, molestias, objetivos). El usuario le pregunta en lenguaje natural ("¿por qué estoy estancado en press inclinado?") y recibe una respuesta fundamentada en SUS datos.
- **El motor determinista es el cerebro de reglas.** Todo cálculo (volumen, tendencias, tolerancias), toda detección de señales y toda regla de seguridad vive en código testeado, NUNCA en el prompt del modelo. Lo determinista y crítico se prueba; lo probabilístico y lingüístico se delega al modelo.
- **La IA nunca recibe historiales crudos.** Invoca herramientas del motor (analyzers, engines) y recibe evidencia estructurada mínima: señales, tendencia, decisión, magnitud y confianza. Esto es por calidad (el LLM no computa a mano ni se colapsa con 30 entrenamientos) y por costo (tokens mínimos necesarios).
- **La confianza modula el discurso.** El nivel de confianza calculado por el motor determina qué tan asertiva es la IA al responder: confianza alta permite recomendaciones directas; confianza baja exige cautela explícita.
- **Estas reglas de negocio son los guardrails de la IA.** La IA propone, explica y personaliza siempre dentro de los límites que el motor certifica. Nunca contradice una decisión del motor; la comunica y la enriquece con contexto.
