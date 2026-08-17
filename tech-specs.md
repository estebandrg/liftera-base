Liftera sera un monorepo, el cual tendra la siguiente arquitectura:

packages:
    web/ ( App web )
    mobile/ (App para dispositivos mobiles)
    core/
        di/
            container.ts (Exporta getInjection se usa en los presentadores)
            
        domain/
        application/
        infrastructure/

Web:
    Nextjs + Tailwind + Gluestack
Mobile: 
    Expo + Gluestack

Core:
    Zod + IoCtopus (IoC container)
    Vitest

Database:
    Supabase + Drizzle

Analytics and error tracking:
    Sentry
    PostHog

Dev deps:
    Turborepo
    Pnpm
    Husky
    ESLint
    Prettier
    

