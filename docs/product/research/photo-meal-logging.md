# Research: photo meal logging

Date: 2026-10-31. Method: pm-product-discovery (identify-assumptions-existing) and pm-market-research (competitor-analysis), web search. Every claim has a link. **Not verified** means I could only find it second hand or could not open the source.

Note on access: this research ran in a cloud session whose network policy blocks `ai.google.dev`, so the Gemini pricing, terms and model pages were read through search results, not opened directly. Check them yourself in step 1 of the key walkthrough.

## 1. Gaps in the idea

1. **A photo cannot see fat.** Oil, ghee and butter cooked into food are invisible. This is the main way photo apps miss (see the NIH study below). The idea already says to always ask. It must also be the one question you cannot skip.
2. **Portion size is the second weak spot.** Even the best models miss weight by about a third on standard photos ([Gothenburg study, PMC12513282](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513282/)). A range is more honest than one number.
3. **Indian home food is mixed.** Dal, sabzi and gravies hide their oil and their ratio of lentil to water. Roti size varies a lot. No study tests LLM portion estimates on Indian food specifically (searched, found none).
4. **Sign in becomes required for this one feature.** Today TRCK works with no account. The photo feature needs one (so the cap and the key stay on the server). The fallback must work without it.
5. **Privacy for friends.** On the free tier, Google may use the photo to improve its models and people may read it (see below). A friend may photograph a meal with their family in frame. The note must be plain and up front, not in a settings page.
6. **Free quota is per Google project, not per user.** If 5 friends use it, they share one daily limit. The 20 per person cap protects it, but 5 x 20 = 100 a day must fit the project quota.
7. **One more server piece to keep alive.** A paused Supabase project (roadmap item 4) would also break photo logging. The fallback covers it.
8. **Who checks the numbers?** The model's per item numbers are "rough". Items that match the user's own food list should use the user's values (the idea already says so).

## 2. What the market is doing

| App | What it does with a photo | Notes |
|---|---|---|
| Cal AI | Photo in, calories and macros out, a few seconds. Single purpose. | Reviewers say it is fast but offers little way to refine from your history ([aiyd comparison](https://aiyd-com.pages.dev/best-ai-for-nutrition-tracking), not verified, review site). |
| MyFitnessPal Meal Scan | Matches what the camera sees to its food database, then you confirm foods, portion and nutrition before logging. | Free or Premium access is reported both ways ([BrainStation](https://brainstation.io/magazine/myfitnesspal-introduces-ai-photo-recognition), not verified). |
| Lose It Snap It | Pick the meal, take a photo, it finds several items in one photo. Free members can try it. | Launched 2016 ([TechCrunch](https://techcrunch.com/2016/09/29/lose-it-launches-snap-it-to-let-users-count-calories-in-food-photos/)). |
| HealthifyMe Snap | Built for Indian food. Claimed 60 to 70 percent recognition at launch in 2023 ([TechCrunch](https://techcrunch.com/2023/09/21/khosla-backed-healthifyme-introduces-ai-powered-image-recognition-for-indian-food/)); about 80 percent for single Indian foods per OpenAI's customer story ([OpenAI](https://openai.com/index/healthify)). | Both are company figures. A "90 percent" figure from a competitor blog could not be verified. Portion estimation is still called a weakness. |
| Cult.fit | Classes, gyms and programs. No public photo meal logging or AI coach found for 2026 ([search](https://www.analyticsinsight.net/amp/story/apps/best-fitness-apps-in-india-to-try-in-2026-top-10-picks), not verified). | The AI coach in Indian apps is HealthifyMe's Ria. |

**The accuracy evidence.**
- **NIH metabolic kitchen study (your seed fact, confirmed second hand).** 102 meals weighed to 0.1 g in an NIH metabolic kitchen, photographed and run through MyFitnessPal, Lose It, Cal AI and Appediet. All four came in low by about 250 to 345 kcal per meal and about 30 g of fat per meal. Lose It and Cal AI also missed about 14 g of carbs. A follow up of 200+ meals found low carb, high fat meals were worse. Presented at NUTRITION 2026 (American Society for Nutrition), a conference talk; I found no peer reviewed paper. Sources: [Healio](https://www.healio.com/news/primary-care/20260804/ai-photobased-calorietracking-tools-underestimate-them-by-33), [Medscape](https://www.medscape.com/viewarticle/photo-based-meal-apps-underestimate-calories-and-fat-2026a1000qo9), [US News](https://www.usnews.com/news/health-news/articles/2026-07-27/how-accurate-are-photo-based-calorie-apps-4-are-put-to-the-test), [Medical Xpress](https://medicalxpress.com/news/2026-07-photo-based-calorie-tracking-apps.html). The researcher's advice: "take the results with a grain of salt" unless you adjust portions.
- **General LLMs on food photos.** GPT-4o and Claude 3.5 Sonnet missed weight by about 36 to 37 percent and energy by about 36 percent. Gemini 1.5 Pro was much worse (64 to 110 percent) ([PMC12513282](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513282/)). That was an older Gemini; newer Flash models are untested in that paper. Sauces are consistently hardest ([Turku thesis](https://www.utupub.fi/handle/11111/61987)).

**Design implication:** never trust a photo alone. Ask about fat every time, show a range, and let the user's own food values win.

## 3. Features worth borrowing

| From | Feature | Borrow? |
|---|---|---|
| MyFitnessPal Meal Scan | Confirm foods and portions before anything is logged | Yes. Nothing logs until you tap Log. |
| Lose It Snap It | Several items found in one photo | Yes. The model lists items, not one dish. |
| HealthifyMe | Indian dish names and household units (katori, roti) | Yes, in the prompt: ask for Indian names and household portions. |
| Cal AI | Speed, one tap from camera | Partly. One tap to camera, but we add one honest question. |
| All of them | One precise calorie number | No. Show a range. |

## 4. Gemini free tier: privacy and images

- **Images on the free tier: yes, with a caveat.** Google's pricing page lists Flash-Lite input (text, image, video) as "Free of charge" on the free tier, for example Gemini 3.1 Flash-Lite at $0.25 per million input tokens on paid and free on free ([Google pricing, via search](https://ai.google.dev/gemini-api/docs/pricing); I could not open the page directly). The separate image *generation* Flash-Lite model has no free tier; we do not need it.
- **Data use on the free tier.** Google's terms treat "unpaid quota in Gemini API" and AI Studio as unpaid services, where prompts and responses may be used to improve Google products and human reviewers may read them; paid use is excluded ([Simon Willison on the terms](https://simonwillison.net/2024/Oct/17/gemini-terms-of-service), [Google terms](https://ai.google.dev/gemini-api/terms), not opened directly; one 2026 source cites terms effective March 23, 2026). **Your seed fact holds** as far as I could check. In the EEA, UK and Switzerland the free tier reportedly does not apply (not verified).
- **Limits.** Free limits are per Google Cloud project, not per key, and reset at midnight Pacific. An older official snapshot listed 15 requests a minute and 1,000 a day for 2.5 Flash-Lite ([Google rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)); a 2026 guide says 500 a day for 3.x Flash-Lite ([scriptbyai](https://www.scriptbyai.com/gemini-api-free-tier-limits/), not verified). The AI Studio quota page is the only source of truth, as you found.
- **Model choice.** Gemini 2.5 Flash-Lite is the cheapest paid image model ($0.10 per million input tokens) but is marked deprecated on the Developer API with no shutdown date yet, and it shut down on Vertex AI on 2026-10-20 ([Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [Firebase models](https://firebase.google.com/docs/ai-logic/models)). Decision: use **`gemini-3.1-flash-lite`**, the cheapest current Flash model that reads images and has a free tier. It is one line in `supabase/functions/meal-photo/config.ts` and can be overridden with a `GEMINI_MODEL` secret. Confirm the exact name in AI Studio during setup (not verified as the GA string).
- **Accuracy warning.** The one published comparison found an older Gemini clearly worse than GPT-4o and Claude on food photos ([PMC12513282](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513282/)). We accept that because it is free, and the design (ask, range, your values win, edit everything) carries the accuracy.

## 5. Indian food

- **HealthifyMe** built its own Indian food recognition (Snap). Public figures are company claims, 60 to 80 percent recognition, and portion size is the known weak spot (links above). Nothing public about how they handle oil.
- **Indian Nutrient Databank (INDB)**: open access, 1,095 raw foods and 1,014 standard recipes, built on ICMR-NIN IFCT 2017 ([paper, PMC11277795](https://pmc.ncbi.nlm.nih.gov/articles/PMC11277795/), [repo](https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB)). The licence for the cooked recipe data is unclear ([third party note](https://glama.ai/mcp/servers/l35f1tg93k), not verified). Good for checking our numbers by hand; we do not bundle it.
- **What we do:** the prompt names Indian household units (roti, katori, ladle, tsp), asks for ingredient level items for mixed dishes (dal: lentils plus tadka oil), and the user's own `Roti`, `Dal` and custom foods override the model.

## 6. Articles worth reading

- NIH study coverage: [Healio](https://www.healio.com/news/primary-care/20260804/ai-photobased-calorietracking-tools-underestimate-them-by-33)
- Three LLMs on food photos: [PMC12513282](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513282/)
- GPT-4V for dietary assessment (scale references help): [arXiv 2312.08592](https://arxiv.org/pdf/2312.08592)
- Benchmark with meal context: [arXiv 2507.07048](https://arxiv.org/html/2507.07048v1)
- Indian Nutrient Databank: [PMC11277795](https://pmc.ncbi.nlm.nih.gov/articles/PMC11277795/)
- Gemini terms explained: [Simon Willison](https://simonwillison.net/2024/Oct/17/gemini-terms-of-service)

## 7. How we build it ourselves, free

1. Browser: pick or take a photo, draw it on a canvas at 1024 px on the long side, JPEG at about 0.8 quality (about 100 to 200 KB). Keep it in memory only.
2. POST to a Supabase Edge Function `meal-photo` with the user's sign in token. Free plan: about 500,000 calls a month ([Supabase limits](https://supabase.com/docs/guides/functions/limits), [freetier.co](https://freetier.co/directory/products/supabase), not verified on Supabase's pricing page).
3. The function checks the token, bumps a per user, per day counter in a tiny table (cap 20), calls Gemini with a JSON schema, and returns JSON only. The key is a function secret.
4. The app parses strictly (bad JSON, missing fields, absurd values like 20,000 kcal), matches items to your food list, adds the fat question, and shows a range.
5. If offline, signed out or over the cap: copy a prompt for Claude with the same questions, then paste Claude's reply back into the same review screen.

Cost: zero on the free tiers above.
