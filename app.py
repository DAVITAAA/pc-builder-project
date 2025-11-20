import os
import json
from flask import Flask, render_template, request, jsonify
from datetime import datetime
import traceback # დაემატა სერვერზე ფატალური შეცდომების უკეთესი ლოგირებისთვის

app = Flask(__name__)


base_dir = os.path.dirname(os.path.abspath(__file__))
# data_dir-ის სწორი განსაზღვრა:
data_dir = os.path.join(base_dir, 'data') 
DATA_FILE = os.path.join(data_dir, 'components.json')
DRAFTS_FILE = os.path.join(data_dir, 'drafts.json')


saved_builds = {}
BUILD_ID_COUNTER = 0
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
    return render_template('index.html')

@app.route('/api/components')
def get_components_data():
    if not COMPONENTS_DATA:
        load_components_from_json()
    # უბრუნებს JSON-ს
    return jsonify(COMPONENTS_DATA)


@app.route('/drafts')
def drafts():
    """დრაფტების გვერდი. ტვირთავს მონაცემებს DRAFTS_FILE-დან."""
    drafts_list = []
    
    # 🔥🔥🔥 უსაფრთხო წაკითხვა DRAFTS_FILE-დან 🔥🔥🔥
    if os.path.exists(DRAFTS_FILE):
        try:
            with open(DRAFTS_FILE, 'r', encoding='utf-8') as f:
                # თუ ფაილი ცარიელია ან არასწორი JSON-ია, დაიჭერს შეცდომას
                drafts_list = json.load(f)
                
                # უსაფრთხოება: დარწმუნდით, რომ drafts_list არის სია
                if not isinstance(drafts_list, list):
                    drafts_list = []
                    
        except json.JSONDecodeError:
            print(f"--- SERVER WARNING: {DRAFTS_FILE} is corrupted or empty.")
            drafts_list = []
        except Exception as e:
            print(f"--- SERVER ERROR loading drafts: {e}")
            drafts_list = []
            
    # გადავცემთ სიას drafts.html შაბლონს
    return render_template('drafts.html', saved_builds=drafts_list)
    # 🔥🔥🔥 END DRAFTS ROUTE 🔥🔥🔥

@app.route('/save-build', methods=['POST'])
def save_build():
    try:
        # 1. მონაცემების მიღება
        data = request.get_json()

        # 2. drafts.json-ის უსაფრთხო ჩატვირთვა
        drafts = []
        if os.path.exists(DRAFTS_FILE):
            with open(DRAFTS_FILE, 'r', encoding='utf-8') as f:
                try:
                    # ვცდილობთ ჩავტვირთოთ
                    drafts = json.load(f)
                except json.JSONDecodeError:
                    # თუ ფაილი დაზიანებულია ან ცარიელია
                    print(f"--- SERVER WARNING: {DRAFTS_FILE} is corrupted or empty, starting with an empty list.")
                    drafts = []
        
        # 3. უნიკალური ID-ს მინიჭება
        # ვიღებთ მაქსიმალურ ID-ს, თუ მასივი ცარიელია, იწყება 1-დან.
        max_id = max([d.get('id', 0) for d in drafts]) if drafts else 0
        build_id = max_id + 1
        
        # მივანიჭოთ ID და დრო
        data['id'] = build_id
        data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 4. ვამატებთ ახალ აწყობას
        drafts.append(data)

        # 5. ვინახავთ ფაილში (უზრუნველყოფს ფოლდერის არსებობას)
        os.makedirs(os.path.dirname(DRAFTS_FILE), exist_ok=True)
        with open(DRAFTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(drafts, f, indent=4)
        
        print(f"--- SERVER LOG: Build {build_id} saved successfully.")
        return jsonify({"success": True, "message": "Build saved successfully", "build_id": build_id})

    except Exception as e:
        # ეს დაგვეხმარება დავინახოთ ზუსტი შეცდომა ტერმინალში, მათ შორის PermissionError
        print(f"--- SERVER FATAL ERROR: Error saving build: {e}")
        traceback.print_exc() # ბეჭდავს სრულ შეცდომის ჟურნალს
        
        return jsonify({"success": False, "message": f"Server processing error: {str(e)}"}), 500
    

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

        # ვფილტრავთ სიას: ვინახავთ ყველა ჩანაწერს, გარდა იმ ID-ისა, რომლის წაშლა გვინდა
        initial_count = len(drafts)
        drafts = [d for d in drafts if d.get('id') != build_id]
        final_count = len(drafts)
        
        if initial_count == final_count:
            print(f"--- SERVER WARNING: Attempted to delete non-existent build ID: {build_id}")
            return jsonify({"success": False, "message": "Build not found."}), 404

        # ვინახავთ განახლებულ სიას ფაილში
        with open(DRAFTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(drafts, f, indent=4)

        print(f"--- SERVER LOG: Build {build_id} deleted successfully.")
        return jsonify({"success": True, "message": "Build deleted."})

    except Exception as e:
        print(f"--- SERVER FATAL ERROR: Error deleting build: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

if __name__ == '__main__':
    # დარწმუნდით, რომ 'data' საქაღალდე არსებობს
    os.makedirs(os.path.join(base_dir, 'data'), exist_ok=True)
    
    # თუ drafts.json არ არსებობს, შევქმნათ ცარიელი სია
    if not os.path.exists(DRAFTS_FILE):
        try:
            with open(DRAFTS_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=4)
        except Exception as e:
             print(f"Fatal error creating drafts file: {e}") # ლოგიკა, თუ ფაილის შექმნა ვერ ხერხდება
            
    app.run(debug=True)