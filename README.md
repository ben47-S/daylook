This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Tenues

Application personnelle de gestion des tenues de travail : on enregistre ses hauts et ses pantalons, on indique lesquels vont ensemble, puis on planifie ses tenues jour par jour avec un suivi du nombre de ports avant lavage.

## 1. Objectif

- Enregistrer chaque pièce (haut ou pantalon) avec une photo, un titre, une couleur et une note de différence avec les pièces similaires.
- Définir les associations haut + pantalon qui vont ensemble.
- Voir une association sous forme de tenue assemblée (haut au-dessus, pantalon en dessous).
- Composer ses tenues en partant soit d'un pantalon, soit d'un haut.
- Planifier les tenues de la semaine et recevoir des propositions pour un jour précis.
- Suivre l'historique des tenues portées et le nombre de ports de chaque pièce depuis son dernier lavage.
- Recevoir la veille des notifications pour confirmer que la tenue du lendemain est repassée.

Usage : une seule personne pour l'instant. La structure de données est prévue pour accueillir plusieurs utilisateurs plus tard.

## 2. Stack technique

- PWA Next.js full-stack (front et routes API dans le même projet), TypeScript
- PostgreSQL avec Prisma
- Notifications : Web Push (VAPID) et un planificateur côté serveur
- Authentification simple : email et mot de passe, JWT en cookie httpOnly
- Photos stockées sur le serveur (volume dédié), servies via une route protégée
- Redimensionnement et compression des images à l'envoi

## 3. Navigation

Trois onglets :

1. **Accueil** : tenue du lendemain (ou du jour) en vue assemblée, son statut, la carte « repassée ? » avec ses boutons, alertes de lavage.
2. **Garde-robe** : grille des hauts et des pantalons (photo, titre, couleur, compteur de ports), bouton « + » pour ajouter une pièce.
3. **Planning** : la semaine, un jour par ligne, statut de chaque tenue. Une icône en haut ouvre l'**historique** dans un bottomsheet.

Écrans ouverts par un clic depuis ces onglets :

- Fiche d'une pièce : détails, bouton « lavé », liste des pièces associées (cases à cocher pour créer ou retirer des associations)
- Vue assemblée d'une association
- Formulaire d'ajout ou de modification d'une pièce
- Fenêtre « non » avec motif
- Choix d'une tenue pour un jour (propositions)

## 4. Règles fonctionnelles

### Pièces
- Types : haut ou pantalon.
- Champs : photo, titre, couleur, description de différence.
- Compteur de ports depuis le dernier lavage, remis à zéro par le bouton « lavé ».
- Seuil optionnel de ports avant lavage, propre à chaque pièce.
- Une pièce supprimée est archivée pour ne pas casser l'historique.

### Associations
- Une association relie un haut et un pantalon. Une même paire n'existe qu'une fois.
- Un haut peut aller avec plusieurs pantalons et inversement.
- Depuis la fiche d'une pièce, on coche toutes les pièces compatibles : chaque coche crée une association.

### Planning et propositions
- Planning par date sur la semaine à venir, une tenue par jour.
- Pour un jour donné, l'app propose des tenues parmi les associations existantes uniquement.
- Filtres : on écarte les pièces dont le seuil de ports (ports réels + ports déjà prévus dans la semaine) serait dépassé.
- Classement : pièces portées le moins souvent ou depuis le plus longtemps en premier ; on évite de reproposer la même pièce deux jours de suite.
- Une pièce peut être portée deux fois dans la même semaine : être déjà programmée un autre jour n'est pas un motif d'exclusion.
- Statuts d'une tenue planifiée : prévue, confirmée (oui), annulée (non, avec motif).

### Historique
- Un enregistrement par jour réellement porté : date, haut, pantalon.
- Le port incrémente le compteur des deux pièces.

## 5. Notifications et alertes

- La veille, notifications push à **20h, 21h, 22h et 23h** : « As-tu repassé la tenue de demain et comptes-tu la porter ? »
- Réponses : **Oui**, ou **Non** avec motif.
- Dès qu'une réponse est donnée, le reste de la série du soir est annulé.
- **Plus tard** : repousse la question de 5 min ou de 30 min (nouvelle notification programmée).
- Une question repoussée reste en attente : on peut la marquer non ou fait à tout moment.
- **À l'ouverture de l'app**, si une question est en attente, l'alerte s'affiche automatiquement, même sans avoir cliqué sur la notification. Elle reste aussi visible sur l'Accueil sous forme de carte.
- Côté serveur : un planificateur (cron ou file de tâches) envoie les notifications aux heures prévues et gère les reports.

## 6. Photos

- Prises avec le téléphone, toujours sur le même fond.
- Le retrait du fond est prévu dans un second temps : on garde la photo d'origine et on prévoit un champ pour la version détourée.
- La vue assemblée empile le haut au-dessus du pantalon ; l'affichage doit rester propre avec ou sans fond retiré.

## 7. Modèle de données (Prisma)

```prisma
enum PieceType {
  TOP
  BOTTOM
}

enum PlanStatus {
  PLANNED
  CONFIRMED
  CANCELLED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  timezone     String   @default("Africa/Abidjan")
  createdAt    DateTime @default(now())

  pieces            Piece[]
  associations      Association[]
  plannedOutfits    PlannedOutfit[]
  wearLogs          WearLog[]
  pushSubscriptions PushSubscription[]
}

model Piece {
  id             String    @id @default(cuid())
  userId         String
  type           PieceType
  title          String
  color          String
  difference     String?
  photoPath      String?
  cutoutPath     String?
  washThreshold  Int?
  wearsSinceWash Int       @default(0)
  lastWashedAt   DateTime?
  archived       Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  asTop     Association[] @relation("AssociationTop")
  asBottom  Association[] @relation("AssociationBottom")
  wornAsTop WearLog[]     @relation("WearTop")
  wornAsBottom WearLog[]  @relation("WearBottom")

  @@index([userId, type])
}

model Association {
  id        String   @id @default(cuid())
  userId    String
  topId     String
  bottomId  String
  createdAt DateTime @default(now())

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  top     Piece           @relation("AssociationTop", fields: [topId], references: [id], onDelete: Cascade)
  bottom  Piece           @relation("AssociationBottom", fields: [bottomId], references: [id], onDelete: Cascade)
  planned PlannedOutfit[]

  @@unique([topId, bottomId])
}

model PlannedOutfit {
  id            String     @id @default(cuid())
  userId        String
  date          DateTime   @db.Date
  associationId String
  status        PlanStatus @default(PLANNED)
  cancelReason  String?
  snoozedUntil  DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  association Association @relation(fields: [associationId], references: [id], onDelete: Cascade)
  wearLog     WearLog?

  @@unique([userId, date])
}

model WearLog {
  id              String   @id @default(cuid())
  userId          String
  date            DateTime @db.Date
  topId           String
  bottomId        String
  plannedOutfitId String?  @unique
  createdAt       DateTime @default(now())

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  top           Piece          @relation("WearTop", fields: [topId], references: [id])
  bottom        Piece          @relation("WearBottom", fields: [bottomId], references: [id])
  plannedOutfit PlannedOutfit? @relation(fields: [plannedOutfitId], references: [id], onDelete: SetNull)

  @@index([userId, date])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Toutes les données sont rattachées à un `userId` dès le départ pour permettre le multi-utilisateur plus tard.

## 8. Routes API (proposition)

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET/POST /api/pieces`, `GET/PATCH/DELETE /api/pieces/:id`, `POST /api/pieces/:id/wash`
- `POST /api/pieces/:id/photo`, `GET /api/photos/:id`
- `GET/POST/DELETE /api/associations`
- `GET /api/planning?from=&to=`, `PUT /api/planning/:date`
- `GET /api/planning/:date/suggestions`
- `POST /api/planning/:date/answer` (oui, non avec motif, plus tard 5 ou 30 min)
- `GET /api/pending-prompt` (question en attente, appelée à l'ouverture de l'app)
- `GET /api/history`
- `POST /api/push/subscribe`

## 9. Feuille de route proposée

1. Authentification, CRUD des pièces, upload des photos
2. Associations et vue assemblée
3. Planning et propositions par jour
4. Notifications, alerte à l'ouverture et « plus tard »
5. Compteurs de ports, lavage, historique en bottomsheet
6. Retrait du fond des photos, puis multi-utilisateurs

## 10. Points à trancher

- Hébergement et déploiement de cette app
- Moment exact où un port est enregistré : le jour J automatiquement pour une tenue confirmée, ou après validation manuelle
- Une seule tenue par jour confirmée comme règle (le modèle l'impose pour l'instant)
- Valeur par défaut du seuil de ports avant lavage, ou pas de seuil tant qu'il n'est pas renseigné
- Outil de retrait du fond (côté serveur ou service externe)
