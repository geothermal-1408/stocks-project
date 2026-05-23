# Qwen1.5-0.5B Installation Guide

> StockSense ML pipeline — Local model setup for development and production.

## 1. Hardware & OS Prerequisites

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | NVIDIA T4 (16 GB VRAM) | A100 (40 GB) |
| CUDA | 11.8+ | 12.1 |
| RAM | 16 GB | 32 GB |
| Storage | 10 GB free | 20 GB free |
| OS | Ubuntu 22.04 LTS / macOS 14+ | Ubuntu 22.04 LTS |

> [!NOTE]
> CPU-only mode works for inference but is too slow for unlearning cycles.
> LoRA fine-tuning with `r=16` fits in ~6 GB VRAM on Qwen1.5-0.5B.

## 2. Python Environment Setup

```bash
# Create isolated conda env
conda create -n stocksense python=3.11 -y
conda activate stocksense

# Install PyTorch with CUDA (adjust for your CUDA version)
# CUDA 12.1:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# CUDA 11.8:
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# macOS (MPS backend):
# pip install torch torchvision torchaudio
```

## 3. Dependencies

```bash
# Core ML dependencies
pip install transformers>=4.37.0 \
            peft>=0.8.0 \
            accelerate>=0.25.0 \
            bitsandbytes>=0.42.0 \
            datasets>=2.15.0 \
            safetensors>=0.4.0

# Data processing
pip install pandas numpy scipy

# StockSense package (editable install)
cd ml/
pip install -e .
```

### Verify installation

```bash
python -c "
import torch
import transformers
import peft
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB')
print(f'Transformers: {transformers.__version__}')
print(f'PEFT: {peft.__version__}')
"
```

## 4. Model Download

```bash
# Option A: HuggingFace CLI (recommended)
pip install huggingface-hub
huggingface-cli download Qwen/Qwen1.5-0.5B --local-dir models/Qwen1.5-0.5B

# Option B: Python script
python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
model_name = 'Qwen/Qwen1.5-0.5B'
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(model_name, trust_remote_code=True)
tokenizer.save_pretrained('models/Qwen1.5-0.5B')
model.save_pretrained('models/Qwen1.5-0.5B')
print('✓ Model downloaded to models/Qwen1.5-0.5B')
"
```

### Expected directory structure

```
models/Qwen1.5-0.5B/
├── config.json
├── generation_config.json
├── model.safetensors
├── special_tokens_map.json
├── tokenizer.json
├── tokenizer_config.json
└── vocab.json
```

## 5. LoRA Adapter Initialisation

The StockSense pipeline uses LoRA (Low-Rank Adaptation) for efficient
fine-tuning and unlearning. Default configuration:

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM

# Load base model
model = AutoModelForCausalLM.from_pretrained(
    "models/Qwen1.5-0.5B",
    torch_dtype="auto",
    device_map="auto",
)

# LoRA configuration
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                        # Rank — higher = more capacity
    lora_alpha=32,               # Scaling factor
    lora_dropout=0.05,           # Regularization
    target_modules=["q_proj", "v_proj"],  # Attention projections
    bias="none",
)

# Apply LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# Expected: trainable params: ~1.5M (0.3% of 494M)
```

### Target modules explained

| Module | Purpose | Why targeted |
|--------|---------|--------------|
| `q_proj` | Query projection in attention | Controls what the model "asks" about each token |
| `v_proj` | Value projection in attention | Controls what information each token contributes |

> [!TIP]
> Adding `k_proj` and `o_proj` increases capacity but doubles VRAM usage.
> For stock data, `q_proj` + `v_proj` provides sufficient adaptation.

## 6. Smoke Test

Run this script to verify end-to-end model loading and inference:

```bash
python -c "
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_path = 'models/Qwen1.5-0.5B'
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map='auto' if torch.cuda.is_available() else None,
)

# Test with a stock data window
prompt = 'date=2024-01-15 open=185.20 high=186.50 low=184.80 close=186.10 vol=42000000'
inputs = tokenizer(prompt, return_tensors='pt')
if torch.cuda.is_available():
    inputs = {k: v.cuda() for k, v in inputs.items()}

with torch.no_grad():
    outputs = model.generate(**inputs, max_new_tokens=50, temperature=0.7)
    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)

print('✓ Smoke test passed')
print(f'Input tokens: {inputs[\"input_ids\"].shape[1]}')
print(f'Output: {decoded[:200]}')
"
```

## 7. Environment Variables

Set these in your `.env` file or shell:

```bash
# Model paths
export MODEL_BASE_PATH=./models/Qwen1.5-0.5B
export OUTPUT_BASE=./output/stock
export DATA_BASE=./data

# Prediction settings
export PREDICTION_SAMPLES=10
export PREDICTION_TEMPERATURE=0.7
export WINDOW_SIZE=30

# Unlearning settings
export UNLEARN_METHOD=ascent_plus_descent
export LEARNING_RATE=5e-6
export FORGET_TRIGGER=5
export MIN_RETAIN_SIZE=20
```

## 8. Common Errors & Fixes

### `torch.cuda.OutOfMemoryError`

**Cause:** Model + optimizer don't fit in VRAM.

```bash
# Fix: Enable 8-bit quantization
pip install bitsandbytes
# Then in code:
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    load_in_8bit=True,
    device_map="auto",
)
```

### `ImportError: No module named 'transformers'`

```bash
# Fix: Ensure you're in the right conda env
conda activate stocksense
pip install transformers
```

### `KeyError: 'qwen'` or `trust_remote_code` warnings

```bash
# Fix: Update transformers to 4.37+
pip install --upgrade transformers
```

### `FileNotFoundError: models/Qwen1.5-0.5B/config.json`

```bash
# Fix: Download the model first (Section 4)
huggingface-cli download Qwen/Qwen1.5-0.5B --local-dir models/Qwen1.5-0.5B
```

### GPU lock contention (`Redis SETNX failed`)

**Cause:** Another process holds the GPU lock (`ss:gpu_lock` in Redis).

```bash
# Check who holds the lock
redis-cli GET ss:gpu_lock

# Force release (use with caution)
redis-cli DEL ss:gpu_lock
```

### Slow inference on macOS

**Cause:** MPS backend falls back to CPU for some ops.

```python
# Fix: Force CPU for consistent behavior
import os
os.environ["PYTORCH_MPS_HIGH_WATERMARK_RATIO"] = "0.0"
```
