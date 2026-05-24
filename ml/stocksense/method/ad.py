"""
AscentPlusDescentTrainer — Primary unlearning method for StockSense.

Erases poisoned windows (gradient ascent on forget set) while simultaneously
reinforcing clean windows (gradient descent on retain set) in a single pass.

Adapted from llm_unlearn/method/ad.py.
"""

import inspect
from typing import Optional

import torch
from torch.utils.data import SequentialSampler
from transformers import DataCollatorWithPadding, Trainer


class AscentPlusDescentTrainer(Trainer):
    """Trainer that applies gradient ascent on forget samples (factor=-1)
    and gradient descent on retain samples (factor>0) simultaneously."""

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        if "factor" not in inputs.keys():
            return super().compute_loss(model, inputs, return_outputs)

        factors = inputs.pop("factor")
        outputs = model(**inputs)
        logits = outputs.logits
        labels = inputs["labels"]

        loss_fct = torch.nn.CrossEntropyLoss(reduction="none")

        shift_logits = logits[..., :-1, :].contiguous()
        shift_labels = labels[..., 1:].contiguous()
        loss = loss_fct(
            shift_logits.reshape(-1, shift_logits.size(-1)),
            shift_labels.reshape(-1),
        )
        valid_counts = (shift_labels != -100).sum(dim=-1).float()

        loss = loss.view(shift_logits.size(0), -1)
        loss = loss.sum(dim=-1) / valid_counts

        # factor=-1 → ascent (forget), factor>0 → descent (retain)
        adjusted_loss = (loss * factors).mean()
        return (adjusted_loss, outputs) if return_outputs else adjusted_loss

    def _get_train_sampler(self, dataset: Optional[torch.utils.data.Dataset] = None) -> Optional[torch.utils.data.Sampler]:
        return SequentialSampler(dataset if dataset is not None else self.train_dataset)

    def _set_signature_columns_if_needed(self):
        if self._signature_columns is None:
            signature = inspect.signature(self.model.forward)
            self._signature_columns = list(signature.parameters.keys())
            self._signature_columns += list(
                set(["label", "label_ids"] + self.label_names)
            )
            self._signature_columns.append("factor")


class AscentPlusDescentDataCollator(DataCollatorWithPadding):
    """Data collator that preserves the 'factor' field for AD training."""

    def __call__(self, features):
        batch = super().__call__(features)
        if "factor" in features[0].keys():
            batch["factor"] = torch.tensor(
                [f["factor"] for f in features]
            )
        return batch
