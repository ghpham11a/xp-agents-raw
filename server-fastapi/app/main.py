from pathlib import Path
from dotenv import load_dotenv

from agent.agent import run_agent

if __name__ == "__main__":

    _ = load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    run_agent(task="What is an LLM. Give me a quick sentence")