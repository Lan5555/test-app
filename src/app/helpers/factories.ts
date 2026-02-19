export class Users{
     email:string = '';
     name:string = ''
     id:number = 0;
     code:string = ''
     codeInfo:Record<string,any> = {}
     score:number = 0;
     time:number = 0;

    constructor(email:string,name:string,id:number,code:string,codeInfo:Record<string,any>, score:number, time:number){
        this.email = email,
        this.name = name,
        this.id = id,
        this.code = code,
        this.codeInfo = codeInfo
        this.score = score;
        this.time = time;
    }

    static fromJson(json:Record<string,any>){
        return new Users(
            json.email,
            json.name,
            json.userId,
            json.code,
            json.codeInfo,
            json.score,
            json.time
        )
    }
}

export interface QuestionItem {
  question: string;
  options: string[];
  correct: number;
}

export class QuestionFactory {
  id: number;
  name: string;
  code: string;
  totalQuestions: number;
  question: QuestionItem[];
  createdAt: Date;
  dynamicTime?: number; // Optional field for dynamic quizzes
  isDynamic?: boolean; // Optional field to indicate if it's a dynamic quiz

  constructor(data: Partial<QuestionFactory>) {
    this.id = data.id ?? 0;
    this.name = data.name ?? '';
    this.code = data.code ?? '';
    this.totalQuestions = data.totalQuestions ?? 0;
    // Ensure each item conforms to QuestionItem
    this.question = (data.question ?? []).map(q => ({
      question: q.question ?? '',
      options: q.options ?? [],
      correct: q.correct ?? 0,
    }));
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.dynamicTime = data.dynamicTime;
    this.isDynamic = data.isDynamic;
  }

  /** Helper: create from API response */
  static fromApi(data: any): QuestionFactory {
    if (Array.isArray(data)) {
      // If API returns multiple questions, map them
      return data.map((item: any) => new QuestionFactory({
        id: item.id,
        name: item.name,
        code: String(item.code),
        totalQuestions: Number(item.totalQuestions),
        question: item.question,
        createdAt: item.createdAt,
        dynamicTime: item.dynamicTime,
        isDynamic: item.dynamic,
      })) as any;
    }
    return new QuestionFactory({
      id: data.id,
      name: data.name,
      code: String(data.code),
      totalQuestions: Number(data.totalQuestions),
      question: data.question,
      createdAt: data.createdAt,
      dynamicTime: data.dynamicTime,
      isDynamic: data.isDynamic,
    });
  }
}

export interface Review {
  question: string;
  picked: string;
  correct: string;
}

export class LogFactory {
  id?: number;
  name: string;
  subtitle: string;
  completedDate: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  review: Review[];

  userId?: number;
  taken?: boolean;
  quizName?: string;

  constructor(
    id: number,
    name: string,
    subtitle: string,
    completedDate: string,
    score: number,
    totalQuestions: number,
    timeSpent: number,
    review: Review[],
    userId?: number,
    quizName?: string,
    taken: boolean = true
  ) {
    this.id = id;
    this.name = name;
    this.subtitle = subtitle;
    this.completedDate = completedDate;
    this.score = score;
    this.totalQuestions = totalQuestions;
    this.timeSpent = timeSpent;
    this.review = review;
    this.userId = userId;
    this.quizName = quizName;
    this.taken = taken;
  }


  /** Create LogFactory instance from a plain JSON object */
  static fromJson(json: any): LogFactory {
    return new LogFactory(
      json.id,
      json.name,
      json.subtitle,
      json.completedDate,
      json.score,
      json.totalQuestions,
      json.timeSpent,
      json.review ?? [],
      json.userId,
      json.quizName,
      json.taken ?? true
    );
  }
}

export interface ProductFormData {
  id: number,
  name: string;
  price: number;
  icon: string;
  description: string;
}

export class Product {
  constructor(
    public id: number,
    public name: string,
    public price: number,
    public icon: string,
    public description: string
  ) {}

  static fromJson(json: Record<string, any>): Product {
    return new Product(
      json['id'],
      typeof json.name === 'string' ? json.name : '',
      typeof json.price === 'number' ? json.price : Number(json.price ?? 0),
      typeof json.icon === 'string' ? json.icon : '',
      typeof json.description === 'string' ? json.description : ''
    );
  }
}
