# page.tsx pataisa dėl Kandidatų anketos

Jeigu Kandidatų anketa dingo, reiškia page.tsx vis dar rodo seną HTML formą arba nerenderina CandidatesModule.

Viršuje turi būti:

import CandidatesModule from "./components/Candidates/CandidatesModule"
import DocumentAcknowledgementsModule from "./components/DocumentAcknowledgements/DocumentAcknowledgementsModule"

Render dalyje turi būti:

{activeTab === "acknowledgements" && (
  <DocumentAcknowledgementsModule
    organizationId={organizationId}
    employees={employees}
    acknowledgements={documentAcknowledgements}
    currentUserId={access?.userId}
    onRefresh={loadAll}
  />
)}

{activeTab === "candidates" && (
  <CandidatesModule
    organizationId={organizationId}
    candidates={candidates}
    onRefresh={loadAll}
  />
)}

Seną Kandidatai bloką, kuriame yra laukai:
- Vardas
- Pavardė
- El. paštas
- Telefonas
- Norimos pareigos
- Patirtis

reikia ištrinti arba pakeisti CandidatesModule renderiu.
