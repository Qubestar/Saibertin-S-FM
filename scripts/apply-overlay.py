#!/usr/bin/env python3
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
UP = ROOT / ".upstream" / "sloop-v2.6"
PIN = "d30d6553353373cf5506b9ed285fc4a2aa0c30ef"


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def replace_once(path: Path, old: str, new: str) -> bool:
    text = path.read_text()
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}")
    path.write_text(text.replace(old, new, 1))
    return True


if not (UP / ".git").exists():
    raise SystemExit("Pinned SLOOP checkout missing. Run: bash scripts/bootstrap-sloop.sh")

head = run("git", "-C", str(UP), "rev-parse", "HEAD")
if head != PIN:
    raise SystemExit(f"Wrong upstream HEAD: {head}; expected {PIN}")

marker = UP / ".saibertin-s-fm-overlay"
if not marker.exists():
    dirty = run("git", "-C", str(UP), "status", "--porcelain")
    if dirty:
        raise SystemExit("Upstream checkout is already modified. Use a clean pinned checkout before applying S-FM.")

for rel in ("firmware/src/sfm.c", "tests/sfm_cc_test.c"):
    src = ROOT / "overlay" / rel
    dst = UP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

felucca = UP / "firmware/src/felucca.c"
replace_once(
    felucca,
    '#include "ui_menu.c"\n#include "ui_input.c"',
    '#include "ui_menu.c"\n#include "sfm.c"          /* Saibertin S-FM overlay */\n#include "ui_input.c"',
)

ui_input = UP / "firmware/src/ui_input.c"
old = '''        if (ui.home) {\n            int16_t *vp;\n            const param_desc_t *d = home_param(k, &vp);'''
new = '''#if SFM_CC_PROOF\n        if (ui.home) {\n            sfm_cc_turn(k, s);\n            ui.hot_col = (uint8_t)k;\n            ui.hot_t = 40;\n            continue;\n        }\n#endif\n        if (ui.home) {\n            int16_t *vp;\n            const param_desc_t *d = home_param(k, &vp);'''
replace_once(ui_input, old, new)

run_tests = UP / "tests/run_tests.sh"
old = '''$CC -Ifirmware/hal -o "$OUT/encoder_test" tests/encoder_test.c\nrun "knobs: one click = one step (slow, fast, pauses, bounce)" "$OUT/encoder_test"'''
new = '''$CC -Ifirmware/hal -o "$OUT/encoder_test" tests/encoder_test.c\nrun "knobs: one click = one step (slow, fast, pauses, bounce)" "$OUT/encoder_test"\n$CC -o "$OUT/sfm_cc_test" tests/sfm_cc_test.c\nrun "Saibertin S-FM: four encoder MIDI CC proof" "$OUT/sfm_cc_test"'''
replace_once(run_tests, old, new)

marker.write_text(f"Saibertin S-FM overlay applied to SLOOP {PIN}\n")
print("Saibertin S-FM overlay applied.")
print(f"Upstream: {UP}")
print("M1 behavior: HOME K1..K4 -> CC74/71/73/91 on the selected track MIDI channel.")
print("Next: build SLOOP, then run tests/run_tests.sh.")
