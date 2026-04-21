A hybrid AI chatbot that gives University of Bradford students personalised careers advice — instantly, 24/7. It combines GPT-4 for natural conversation with a custom Node.js backend that retrieves verified data from Firebase and Google Search, so responses are both fluent and accurate.

<img width="264" height="367" alt="image" src="https://github.com/user-attachments/assets/b7df817e-3d83-4da6-ba9b-f898990fe87b" />

Stack
•	Frontend: HTML, CSS, JavaScript
•	Backend: Node.js + Express
•	AI: OpenAI GPT-4 API
•	Database: Firebase Firestore
•	Search: Google Custom Search API (UoB + Prospects.ac.uk)

Q: What problem does this solve?

"During my IT internship at the University of Bradford, I noticed a recurring problem: students were constantly asking for career advice, but they couldn't get personalized guidance outside of standard office hours.
I realized the information they needed was actually available, but it was scattered across dozens of different web pages, making it hard for students to find. To solve this, I built my AI Chatbot. I wanted to take that 'scattered' data and turn it into a single point of contact that provides instant, tailored guidance to any student, at any time."

Why these technologies?
I evaluated Dialogflow (too rigid), IBM Watson (£140/month, too expensive), and GPT-4. GPT-4 won on flexibility, cost, and rapid integration. Node.js suits API orchestration. Firebase is fast to set up and scales automatically and you recive free credits usign a student account.

Q: What went wrong? How did you fix it?
I built 3 weeks of Dialogflow before realising it couldn't handle open-ended queries — students ask questions from too many angles. I pivoted to GPT-4. The intent taxonomy I'd built became the system prompt structure, so the work wasn't wasted. Taught me to prototype before committing.

What is hallucination?
Hallucination is when an AI model like GPT-4 confidently generates information that sounds correct but is actually made up. For example, it might invent a salary figure, fabricate a scholarship that doesn't exist, or misstate a course entry requirement — all stated with complete confidence and no warning.
In a careers chatbot context, this is a serious problem. A student might make a real decision — choosing a degree, applying for a grant — based on false information the chatbot invented.

How I fixed it — Retrieval-Augmented Generation (RAG)
Instead of letting GPT-4 generate answers from scratch (where it can hallucinate), I made the backend retrieve real, verified data first, then pass that data to GPT-4 as context. GPT-4's job then becomes summarising and explaining real information — not inventing it.
The three sources I retrieve from are:

Firebase Firestore — structured university data (programmes, scholarships, careers)
Google Custom Search API — restricted to UoB and Prospects.ac.uk only
System-level prompting — instructs GPT-4 to express uncertainty rather than guess, and to stay within careers/education topics

This is actually a standard industry technique called RAG (Retrieval-Augmented Generation) — I arrived at it independently by solving the problem practically, then learned it had a formal name.

Q: How do you stop GPT-4 making things up?
Database-first retrieval — backend queries Firebase or Google Search first, injects verified data into GPT-4's prompt as context. GPT-4 summarises real data rather than generating facts. Domain prompts also tell it to flag uncertainty rather than guess.

Q: Is it production-ready?
It's a prototype — all core features work. Next steps: user testing with real students, security audit, admin dashboard for staff to update the knowledge base, and load testing for 50+ concurrent users.

Features — One Line Each
•	Natural language input — no rigid menus, students type freely
•	User profiling — identifies prospective / current / graduate at session start
•	Multi-source retrieval — Firebase, Google Search, GPT-4 combined
•	Session context — remembers what was said earlier in the conversation
•	Topic filtering — keeps GPT-4 on careers/education topics only
•	Source links — responses include links so students can verify info

Next Steps - Adding multi language translation for international students accomidating for more students.


