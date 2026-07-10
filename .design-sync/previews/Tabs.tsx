import { Tabs, TabsContent, TabsList, TabsTrigger } from "web";

export const LessonTabs = () => (
  <Tabs defaultValue="lecture" className="w-96">
    <TabsList>
      <TabsTrigger value="lecture">Bài giảng</TabsTrigger>
      <TabsTrigger value="vocab">Từ vựng</TabsTrigger>
      <TabsTrigger value="exercise">Bài tập</TabsTrigger>
    </TabsList>
    <TabsContent value="lecture" className="pt-3 text-muted-foreground">
      Thì hiện tại hoàn thành diễn tả hành động bắt đầu trong quá khứ và còn
      liên quan tới hiện tại.
    </TabsContent>
    <TabsContent value="vocab" className="pt-3 text-muted-foreground">
      18 từ mới trong bài này.
    </TabsContent>
    <TabsContent value="exercise" className="pt-3 text-muted-foreground">
      12 câu hỏi trắc nghiệm.
    </TabsContent>
  </Tabs>
);

export const LineVariant = () => (
  <Tabs defaultValue="reading" className="w-96">
    <TabsList variant="line">
      <TabsTrigger value="reading">Reading</TabsTrigger>
      <TabsTrigger value="writing">Writing</TabsTrigger>
      <TabsTrigger value="speaking">Speaking</TabsTrigger>
    </TabsList>
    <TabsContent value="reading" className="pt-3 text-muted-foreground">
      Đề đọc gồm 3 passage, 40 câu hỏi trong 60 phút.
    </TabsContent>
    <TabsContent value="writing" className="pt-3 text-muted-foreground">
      Task 1 và Task 2, tổng 60 phút.
    </TabsContent>
    <TabsContent value="speaking" className="pt-3 text-muted-foreground">
      Ba phần thi, 11–14 phút.
    </TabsContent>
  </Tabs>
);
