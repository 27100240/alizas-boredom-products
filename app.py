from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/neon-pong")
def neon_pong():
    return render_template("neon_pong.html")

@app.route("/memory-match")
def memory_match():
    return render_template("memory.html")

@app.route("/neon-palette")
def neon_palette():
    return render_template("palette.html")

if __name__ == "__main__":
    app.run(debug=True)