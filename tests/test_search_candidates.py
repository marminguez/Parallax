import importlib.util
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
spec = importlib.util.spec_from_file_location("search_candidates", Path(__file__).parents[1] / "scripts/search_candidates.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


@pytest.mark.parametrize("bounds", [
    ["--west", "10", "--east", "0", "--south", "0", "--north", "1"],
    ["--west", "0", "--east", "20", "--south", "0", "--north", "1"],
    ["--west", "0", "--east", "1", "--south", "-90", "--north", "-80"],
    ["--west", "nan", "--east", "1", "--south", "0", "--north", "1"],
])
def test_live_runner_rejects_invalid_scientific_domains(monkeypatch, bounds):
    monkeypatch.setattr(sys, "argv", ["search_candidates.py", *bounds])
    with pytest.raises(SystemExit):
        runner.main()


def test_live_runner_never_substitutes_demo_data_when_rasters_missing(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["search_candidates.py", "--west", "0", "--east", "1", "--south", "0", "--north", "1"])
    with pytest.raises(FileNotFoundError, match="SRTMGL30"):
        runner.main()
