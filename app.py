import os
import json
from flask import Flask, render_template, request, jsonify
from datetime import datetime
import traceback 

app = Flask(__name__)

# --- CUSTOM TRANSLATION SYSTEM (REPLACES BABEL) ---

# თარგმანების ლექსიკონი
# NOTE: აქ უნდა განთავსდეს ყველა სტრიქონი, რომელიც საჭიროა HTML-ში თარგმნისთვის
TRANSLATIONS = {
    'en': {
        "SynthForge PC Builder": "SynthForge PC Builder",
        "Build, validate, and summarize your dream rig with real-time component compatibility checks.": "Build, validate, and summarize your dream rig with real-time component compatibility checks.",
        "Home": "Home",
        "Saved Drafts": "Saved Drafts",
        "Build saved successfully": "Build saved successfully",
        "Server processing error: %(error)s": "Server processing error: %(error)s",
        "Build deleted.": "Build deleted.",
        "Build not found.": "Build not found.",
        "Server error: %(error)s": "Server error: %(error)s",
        # Drafts page specific
        "Draft Name": "Draft Name",
        "Total Price": "Total Price",
        "Power Draw": "Power Draw",
        "Components": "Components",
        "Saved Date": "Saved Date",
        "View Summary": "View Summary",
        "Delete": "Delete",
        "No drafts saved yet. Start building your PC!": "No drafts saved yet. Start building your PC!",
    },
    'ka': {
        "SynthForge PC Builder": "SynthForge კომპიუტერის ამწყობი",
        "Build, validate, and summarize your dream rig with real-time component compatibility checks.": "ააწყვეთ, შეამოწმეთ და შეაჯამეთ თქვენი ოცნების სისტემა რეალურ დროში კომპონენტების თავსებადობის შემოწმებით.",
        "Home": "მთავარი",
        "Saved Drafts": "შენახული დრაფტები",
        "Build saved successfully": "აწყობა წარმატებით შეინახა",
        "Server processing error: %(error)s": "სერვერის დამუშავების შეცდომა: %(error)s",
        "Build deleted.": "დრაფტი წაიშალა.",
        "Build not found.": "დრაფტი ვერ მოიძებნა.",
        "Server error: %(error)s": "სერვერის შეცდომა: %(error)s",
        # Drafts page specific
        "Draft Name": "დრაფტის სახელი",
        "Total Price": "ჯამური ფასი",
        "Power Draw": "ენერგიის მოხმარება",
        "Components": "კომპონენტები",
        "Saved Date": "შენახვის თარიღი",
        "View Summary": "ნახვა",
        "Delete": "წაშლა",
        "No drafts saved yet. Start building your PC!": "ჯერ არ გაქვთ შენახული დრაფტები. დაიწყეთ კომპიუტერის აწყობა!",
    }
}

# ენის ამორჩევა ქუქი-ფაილიდან
def get_locale():
    # 1. ვცდილობთ წავიკითხოთ 'sf_lang' ქუქი-ფაილი JavaScript-დან
    lang = request.cookies.get('sf_lang')
    # 2. თუ ენა ვალიდურია, დავაბრუნოთ ის, თუ არადა 'ka'
    if lang in TRANSLATIONS:
        return lang
    return 'ka' # ნაგულისხმევი ენა

# gettext ფუნქციის იმიტაცია
def custom_gettext(message, **variables):
    locale = get_locale()
    
    # ავიღოთ თარგმანი, თუ არსებობს
    translated_message = TRANSLATIONS.get(locale, {}).get(message, message)
    
    # შევცვალოთ ცვლადები (მაგ. %(error)s)
    if variables:
        for key, value in variables.items():
            # იყენებს Jinja-ს მსგავს სინტაქსს, რომელიც Flask-ისგან მოდის
            translated_message = translated_message.replace(f"%({key})s", str(value))
    
    return translated_message

_ = custom_gettext # ვანიჭებთ _ ფუნქციას ჩვენს custom_gettext-ს, როგორც Babel-ში იყო

# --- DATA PATHS & LOAD LOGIC (UNCHANGED) ---
base_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(base_dir, 'data') 
DATA_FILE = os.path.join(data_dir, 'components.json')
DRAFTS_FILE = os.path.join(data_dir, 'drafts.json')

COMPONENTS_DATA = [] 

def load_components_from_json():
    """
    ტვირთავს მონაცემებს data/components.json ფაილიდან.
    """
    global COMPONENTS_DATA
    
    file_path = DATA_FILE 
    
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # 🔥 უსაფრთხოების შემოწმება: თუ მონაცემები Dictionary-ია, გადავიყვანოთ List-ად JS-ისთვის
                if isinstance(data, dict):
                    flat_list = []
                    for comp_type, items in data.items():
                        if isinstance(items, list):
                            for item in items:
                                if 'type' not in item:
                                    item['type'] = comp_type
                                flat_list.append(item)
                    COMPONENTS_DATA = flat_list
                else:
                    COMPONENTS_DATA = data
                
                print(f"✅ Components loaded successfully. Found {len(COMPONENTS_DATA)} items.")
        else:
            print(f"⚠️ Warning: Component file not found at path: {file_path}")
            COMPONENTS_DATA = []
            
    except json.JSONDecodeError as e:
        print(f"❌ Error loading JSON from {file_path}: {e}")
        COMPONENTS_DATA = []
    except Exception as e:
        print(f"❌ General Error loading data: {e}")
        COMPONENTS_DATA = []

# აპლიკაციის გაშვებისას ჩავტვირთოთ მონაცემები
load_components_from_json()

# --- FLASK ROUTES ---

@app.route('/')
@app.route('/home')
def home():
    # გადავცემთ custom_gettext ფუნქციას შაბლონს, როგორც _
    return render_template('index.html', lang=get_locale(), _=_)

@app.route('/api/components')
def get_components_data():
    if not COMPONENTS_DATA:
        load_components_from_json()
    return jsonify(COMPONENTS_DATA)


@app.route('/drafts')
def drafts():
    """დრაფტების გვერდი. ტვირთავს მონაცემებს DRAFTS_FILE-დან."""
    drafts_list = []
    
    # 🔥🔥🔥 უსაფრთხო წაკითხვა DRAFTS_FILE-დან 🔥🔥🔥
    if os.path.exists(DRAFTS_FILE):
        try:
            with open(DRAFTS_FILE, 'r', encoding='utf-8') as f:
                drafts_list = json.load(f)
                
                if not isinstance(drafts_list, list):
                    drafts_list = []
                    
        except json.JSONDecodeError:
            print(f"--- SERVER WARNING: {DRAFTS_FILE} is corrupted or empty.")
            drafts_list = []
        except Exception as e:
            print(f"--- SERVER ERROR loading drafts: {e}")
            drafts_list = []
            
    # გადავცემთ custom_gettext ფუნქციას შაბლონს, როგორც _
    return render_template('drafts.html', saved_builds=drafts_list, lang=get_locale(), _=_)


@app.route('/save-build', methods=['POST'])
def save_build():
    try:
        data = request.get_json()

        drafts = []
        if os.path.exists(DRAFTS_FILE):
            with open(DRAFTS_FILE, 'r', encoding='utf-8') as f:
                try:
                    drafts = json.load(f)
                except json.JSONDecodeError:
                    print(f"--- SERVER WARNING: {DRAFTS_FILE} is corrupted or empty, starting with an empty list.")
                    drafts = []
        
        # უნიკალური ID-ს მინიჭება
        max_id = max([d.get('id', 0) for d in drafts]) if drafts else 0
        build_id = max_id + 1
        
        # მივანიჭოთ ID და დრო
        data['id'] = build_id
        # Data-ში შემავალი stats ობიექტი უნდა იყოს განახლებული
        if 'stats' not in data:
             data['stats'] = {}
        data['stats']['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # ვამატებთ ახალ აწყობას
        drafts.append(data)

        # ვინახავთ ფაილში
        os.makedirs(os.path.dirname(DRAFTS_FILE), exist_ok=True)
        with open(DRAFTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(drafts, f, indent=4)
        
        print(f"--- SERVER LOG: Build {build_id} saved successfully.")
        return jsonify({"success": True, "message": _("Build saved successfully"), "build_id": build_id})

    except Exception as e:
        print(f"--- SERVER FATAL ERROR: Error saving build: {e}")
        traceback.print_exc()
        
        return jsonify({"success": False, "message": _("Server processing error: %(error)s", error=str(e))}), 500
    

@app.route('/delete-draft/<int:build_id>', methods=['POST'])
def delete_draft(build_id):
    try:
        drafts = []
        if os.path.exists(DRAFTS_FILE):
            with open(DRAFTS_FILE, 'r', encoding='utf-8') as f:
                try:
                    drafts = json.load(f)
                except json.JSONDecodeError:
                    drafts = []

        initial_count = len(drafts)
        drafts = [d for d in drafts if d.get('id') != build_id]
        final_count = len(drafts)
        
        if initial_count == final_count:
            print(f"--- SERVER WARNING: Attempted to delete non-existent build ID: {build_id}")
            return jsonify({"success": False, "message": _("Build not found.")}), 404

        with open(DRAFTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(drafts, f, indent=4)

        print(f"--- SERVER LOG: Build {build_id} deleted successfully.")
        return jsonify({"success": True, "message": _("Build deleted.")})

    except Exception as e:
        print(f"--- SERVER FATAL ERROR: Error deleting build: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": _("Server error: %(error)s", error=str(e))}), 500

if __name__ == '__main__':
    # დარწმუნდით, რომ 'data' საქაღალდე არსებობს
    os.makedirs(os.path.join(base_dir, 'data'), exist_ok=True)
    
    # თუ drafts.json არ არსებობს, შევქმნათ ცარიელი სია
    if not os.path.exists(DRAFTS_FILE):
        try:
            with open(DRAFTS_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=4)
        except Exception as e:
            print(f"Fatal error creating drafts file: {e}") 
            
    app.run(debug=True)