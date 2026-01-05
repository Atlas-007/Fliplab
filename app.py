from flask import Flask, render_template, request, jsonify
import time
import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


app = Flask(__name__)
BASE_T     = 0
START_TIME = time.time()

#Deployment
app.config["DEBUG"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-placeholder")
app.config['MAX_CONTENT_LENGTH'] = 4 * 1024 * 1024
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day","50 per hour"])
limiter.init_app(app)

@app.route('/')
def home():
    return render_template('index.html', title='Hello, Flask!', message='This page is rendered from a template.')

@app.route('/4x')
def x4x():
    return render_template('4x.html')

@app.route('/simulation')
def greet():
    return render_template('simulation.html')

@app.route('/siteconfpass11a5')
def conf():
    return render_template('conf.html')

@app.route('/404')
def cE():
    return render_template('404.html')


@app.route("/health")
def health():
    return "OK", 200

if __name__ == '__main__':
    app.run(debug=True)
