import os
from flask import Flask, render_template

# მივიღოთ მიმდინარე დირექტორიის აბსოლუტური გზა
base_dir = os.path.abspath(os.path.dirname(__file__))

# Flask-ის ინიციალიზაცია, სადაც მკაფიოდ ვუთითებთ templates და static საქაღალდეებს
app = Flask(
    __name__, 
    # templates საქაღალდის გზა
    template_folder=os.path.join(base_dir, 'templates'),
    # ** აუცილებელი დამატება: static საქაღალდის გზა **
    static_folder=os.path.join(base_dir, 'static')
)

@app.route('/')
def home():
    # render_template ეძებს index.html-ს templates/index.html-ში
    return render_template('index.html')

if __name__ == '__main__':
    print(f"Base directory: {base_dir}")
    print("Flask Server is running on http://127.0.0.1:5000/")
    # დარწმუნდით, რომ აპლიკაციას გაუშვებთ app.py-ის შემცველი საქაღალდედან (PCBULDSITE)
    app.run(debug=True)