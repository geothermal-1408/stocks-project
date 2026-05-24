"""
AscentPlusKLDivergenceTrainer — KL-anchored unlearning for sparse retain data.

Uses gradient ascent on forget set + forward KL divergence against a reference
model to prevent catastrophic drift when clean retain data is limited.

Adapted from llm_unlearn/method/akl.py.
"""

import inspect
from typing import Optional

import torch
from torch.utils.data import SequentialSampler
from transformers import Trainer


class AscentPlusKLDivergenceTrainer(Trainer):
    """Trainer combining gradient ascent on forget + KL anchor on retain."""

    def __init__(self, pretrain_model=None, **kwargs):
        super().__init__(**kwargs)
        device = self.accelerator.device
        pretrain_model.to(device)
        self.pretrain_model = pretrain_model

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        if "factor" not in inputs.keys():
            return super().compute_loss(model, inputs, return_outputs)

        factors = inputs.pop("factor")
        negative_inputs = {
            key: val[factors == -1] for key, val in inputs.items()
        }
        positive_inputs = {
            key: val[factors != -1] for key, val in inputs.items()
        }

        if len(negative_inputs["input_ids"]) != 0:
            outputs = model(**negative_inputs)
            negative_loss = outputs.loss * -1
        else:
            negative_loss = 0

        if len(positive_inputs["input_ids"]) != 0:
            positive_loss = (
                compute_kl(
                    self.pretrain_model,
                    model,
                    positive_inputs,
                    self.accelerator.device,
                )
                * factors[factors != -1][0]
            )
        else:
            positive_loss = 0

        loss = negative_loss + positive_loss
        return (loss, outputs) if return_outputs else loss

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


# Based on kevinyaobytedance/llm_unlearn (MIT license)
def compute_kl(pretrained_model, current_model, batch, device):
    """Compute forward KL divergence as the normal utility loss.

    Args:
        pretrained_model: Reference (original) model.
        current_model: The current unlearning model.
        batch: A batch of normal data.
        device: GPU device.

    Returns:
        The KL loss.
    """
    normal_outputs = current_model(
        batch["input_ids"].to(device),
        attention_mask=batch["attention_mask"].to(device),
        labels=batch["labels"].to(device),
    )

    with torch.no_grad():
        pretrained_outputs = pretrained_model(
            batch["input_ids"].to(device),
            attention_mask=batch["attention_mask"].to(device),
            labels=batch["labels"].to(device),
        )

    # P: pretrained model; Q: current model.
    prob_p = torch.nn.functional.softmax(pretrained_outputs.logits, -1)
    prob_q = torch.nn.functional.softmax(normal_outputs.logits, -1)

    loss = -(prob_p * torch.log(prob_q + 1e-12)).sum(-1).mean()

    return loss
