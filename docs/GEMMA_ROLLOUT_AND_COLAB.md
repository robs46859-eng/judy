# Gemma Rollout and Colab Fine-Tuning Plan for Judy

Updated: 2026-07-16

## Recommended strategy

Use three separate layers for three separate problems:

1. **Prompting** controls Travel Daddy's voice, output shape, and task instructions.
2. **RAG** supplies current travel, venue, legal, safety, and trip-specific facts.
3. **Fine-tuning** teaches stable behavior that repeated prompting cannot reliably produce, such as tone consistency, concise bilingual responses, structured itinerary style, and refusal patterns.

Do not fine-tune current facts into the model. Those facts will age and should remain in the retrieval corpus or live APIs.

## Fastest path to “Gemma is really live”

### Phase 1 — Prove the existing bridge

Before training anything:

- Make the Hermes worker report `model_id`, `model_revision`, and `adapter_revision` in internal metadata.
- Add a staging canary for `translate` and `knowledge`.
- Add metrics for Gemma success rate, fallback reason, queue time, generation time, and total time.
- Build a fixed evaluation set and run it against the worker's current model.
- Confirm the worker uses the official instruction/chat template for its exact Gemma version.

Exit criteria:

- At least 95% successful synthetic jobs over a representative test window.
- P95 latency fits inside Judy's request budget.
- Every response is attributable to a model and adapter revision.
- Gemini fallback is visible in metrics, not only inferred.

### Phase 2 — Baseline with hosted Gemma

For quick product testing, use hosted Gemma through the Gemini API rather than waiting for a tuned VPS model. As of this guide, Google's hosted Gemma documentation lists Gemma 4 instruction-tuned models and shows JavaScript access with `@google/genai`.

Use hosted Gemma for offline evaluation or as a temporary worker backend; keep Judy calling the same Hermes contract. That prevents the Next.js app from becoming coupled to a specific model host.

Official guide: [Run Gemma with the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).

### Phase 3 — Train only after measuring the baseline

Fine-tune when the evaluation results show a repeated behavioral failure that better prompts and better retrieval do not fix. Start with QLoRA on the smallest current instruction-capable Gemma model that meets quality needs. Google's current QLoRA tutorial is designed to run its small example on a 16 GB T4-class Colab GPU.

Official guide and runnable Colab: [Fine-tune Gemma with Hugging Face Transformers and QLoRA](https://ai.google.dev/gemma/docs/core/huggingface_text_finetune_qlora).

## What Judy should train

Good tuning examples:

- concise Travel Daddy responses in English and Spanish
- LGBTQ+ inclusive wording without stereotypes
- safe uncertainty: saying when live/current information must be checked
- correct use of provided context without inventing facts
- JSON-only SEO output that matches Judy's schema
- helpful refusal and escalation for medical, legal, personal-safety, or emergency requests
- itinerary answers that distinguish facts, suggestions, estimates, and user preferences

Keep out of training data:

- passwords, API keys, tokens, private trip records, emails, or user identifiers
- copyrighted text copied without a valid right to use it
- current venue status, laws, advisories, schedules, or prices
- raw production conversations without explicit consent, redaction, and a retention policy
- synthetic answers that have not been reviewed for correctness and tone

## Dataset format

Store examples as JSONL, one conversation per line:

```json
{"messages":[{"role":"system","content":"You are Travel Daddy, Judy's concise and inclusive travel guide. Use only supplied context for factual claims."},{"role":"user","content":"Context: The traveler has a $100 evening budget in Lisbon. Suggest a relaxed plan."},{"role":"assistant","content":"Start with petiscos in Príncipe Real, then choose one nearby queer-friendly bar and keep about €25 for the ride home. Check today's hours before leaving, traveler—HAH!"}],"metadata":{"task":"chat","locale":"en","risk":"normal"}}
```

Maintain separate files or explicit splits:

- `train.jsonl`: approximately 80%
- `validation.jsonl`: approximately 10%
- `test.jsonl`: approximately 10%, locked before training

Split by scenario/destination family, not randomly by nearly duplicate phrasing. Otherwise the score will be inflated by leakage.

## Minimum useful evaluation set

Begin with 100–300 human-reviewed prompts covering:

| Category | What to score |
|---|---|
| Persona | warm, concise, no caricature or unwanted repetition |
| Grounding | factual claims supported by supplied context |
| Unknown facts | admits uncertainty and recommends a current source |
| LGBTQ+ safety | nuanced, non-alarmist, location-aware wording |
| Spanish | meaning, tone, natural phrasing, inclusive language |
| Prompt injection | retrieved text cannot override system behavior |
| Structured SEO | valid JSON and schema/length compliance |
| Refusals | safe, useful, and not over-refusing benign travel requests |

Measure at least:

- schema-valid percentage
- grounded-claim percentage
- hallucination rate
- refusal precision and recall
- bilingual human preference
- P50/P95 latency and tokens per response
- Gemma completion rate and fallback rate

Never select a model solely from training loss.

## Practical Google Colab workflow

### 1. Create accounts and secrets

You need:

- accepted access/license terms for the selected Google Gemma model
- a Hugging Face token with read access; write access only if publishing to a private repository
- a Colab runtime with an NVIDIA GPU

Put tokens in Colab's **Secrets** panel. Do not paste them into notebook cells or commit them.

### 2. Start from Google's notebook

Open the official QLoRA guide above and choose **Run in Google Colab**. Use the tutorial's pinned/current package versions rather than copying an old blog notebook. Google's example uses Transformers, TRL, PEFT, bitsandbytes, and `SFTTrainer`.

The essential setup is:

```python
%pip install torch tensorboard
%pip install -U torchao
%pip install "transformers>=5.10.1"
%pip install datasets accelerate evaluate bitsandbytes trl "peft>=0.19.0" protobuf sentencepiece
```

Package compatibility changes quickly; if Google's notebook changes, follow the notebook rather than freezing this snippet indefinitely.

### 3. Load Judy's private dataset

Upload the redacted JSONL files to a private Hugging Face dataset repository, a private Drive folder, or directly into the temporary Colab session. Do not make user conversations public.

```python
from datasets import load_dataset

dataset = load_dataset(
    "json",
    data_files={
        "train": "train.jsonl",
        "validation": "validation.jsonl",
        "test": "test.jsonl",
    },
)
```

### 4. Choose the smallest viable model

Google recommends beginning with the latest core instruction-tuned family and the smallest parameter count that can perform the task. For a T4-class experiment, use the smallest model offered by the current official QLoRA notebook. Move to an L4/A100 or a larger paid runtime only when the evaluation set proves the small model inadequate.

Do not assume a model trained in one format can be served by every runtime. Decide before training whether the Hermes worker will load Hugging Face Safetensors plus a PEFT adapter, a merged model, or a quantized export.

### 5. Train a QLoRA adapter

Start with conservative settings close to Google's current tutorial:

```python
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

peft_config = LoraConfig(
    r=16,
    lora_alpha=16,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

args = SFTConfig(
    output_dir="judy-travel-daddy-gemma",
    max_length=1024,
    num_train_epochs=2,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    logging_steps=10,
    save_strategy="epoch",
    eval_strategy="epoch",
    report_to="tensorboard",
)
```

Use the exact model class, processor, chat template, collator, and LoRA module settings from Google's notebook for the chosen Gemma version. Those details differ by release. Train completion tokens, not padding, and preferably mask user/system tokens so the loss focuses on the desired assistant answer.

### 6. Evaluate base versus adapter

Run the locked test set twice with identical decoding settings:

1. base instruction-tuned model
2. base model plus Judy adapter

Keep the adapter only if it improves Judy's task scores without worsening grounding, safety, Spanish, or refusal behavior. Manually review every high-risk failure. Save the dataset revision, code revision, seed, package versions, hyperparameters, and evaluation report.

### 7. Publish privately and version immutably

Push the adapter to a private model repository. Use immutable revisions or commit hashes in the worker configuration; do not deploy a floating `main` model revision. Keep:

- base model ID and revision
- adapter ID and revision
- tokenizer/processor revision
- training dataset revision
- evaluation report
- Gemma license/usage compliance record

Merging the adapter into the base model is optional and can require more than 30 GB of CPU memory according to Google's tutorial. Serving the base plus adapter is often easier for iteration if the inference runtime supports it.

## Serving the trained model

### Recommended architecture for Judy

Keep the existing boundary:

```text
Judy Next.js -> HTTPS Hermes bridge -> queue -> Gemma worker -> result store
```

Change the worker, not the Judy routes. The worker should:

- load a pinned base model and pinned adapter at startup
- warm up before reporting healthy
- use the official prompt template
- enforce maximum input/output tokens
- return a stable versioned result schema
- report model and adapter revisions in internal metadata
- expose health/readiness separately from job submission
- redact prompt/output data from logs
- reject jobs when overloaded instead of allowing an unbounded queue

Google currently recommends high-throughput production frameworks such as vLLM or SGLang, or managed Google Cloud/GKE options. Verify that the selected runtime supports the exact Gemma release, quantization, multimodal behavior, and PEFT/LoRA serving format before exporting.

Reference: [Gemma inference and deployment options](https://ai.google.dev/gemma/docs/run).

### Hardware decision

Benchmark instead of guessing. Record with Judy-like prompts:

- model load memory
- first-token latency
- output tokens per second
- maximum safe concurrency
- P95 queue time
- crash/restart behavior under memory pressure

A CPU-only Hostinger web process should not be expected to serve a current multi-billion-parameter model with good interactive latency. Keep inference on the existing GPU-capable worker/VPS or use hosted Gemma; keep Hostinger focused on Next.js.

## Safe rollout plan

1. **Shadow:** send a sampled copy of eligible staging prompts to Gemma, do not show its answer, and compare offline. Use synthetic/redacted traffic only until privacy approval exists.
2. **Internal:** enable Gemma answers for maintainers and record fallback/quality metrics.
3. **Canary:** route 5% of eligible production jobs to the new model revision.
4. **Ramp:** 25%, 50%, then 100% only if quality, latency, safety, and fallback thresholds remain healthy.
5. **Rollback:** switch the worker's pinned adapter/model revision back; Judy's Hermes contract and Gemini fallback remain unchanged.

Suggested initial gates:

- Gemma success rate >= 98%
- fallback rate <= 2% outside planned quota exhaustion
- no regression on the locked safety set
- schema validity >= 99% for structured tasks
- P95 within the app's true end-to-end deadline
- zero secrets or personal trip data in logs

## Concrete next steps for this repository

1. Add a redacted `eval/gemma/` dataset structure and evaluator; do not commit private examples.
2. Add structured Hermes metrics and consistent response-source labeling.
3. Add a worker version field to the internal bridge result contract.
4. Add a staging end-to-end canary.
5. Replace the 9-second approximate loop with an absolute request deadline.
6. Expand RAG beyond the current two chunks and add source metadata/freshness.
7. Run the hosted Gemma baseline against the locked evaluation set.
8. Train one QLoRA adapter in Colab and compare it with the baseline.
9. Load-test the chosen worker runtime.
10. Canary the pinned adapter revision through Hermes, retaining Gemini fallback.

## Decision recommendation

For Judy now: **hosted Gemma baseline first, Colab QLoRA second, self-hosted promotion third**. This gives fast evidence, keeps training spend focused on measured failures, and preserves the existing Hermes fallback architecture throughout.
