declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: {
        id?: number;
        url?: string;
        title?: string;
      };
      frameId?: number;
      id?: string;
      url?: string;
    }

    const lastError: { message?: string } | undefined;

    function sendMessage<M = any, R = any>(
      message: M
    ): Promise<R>;

    function sendMessage<M = any, R = any>(
      extensionId: string,
      message: M
    ): Promise<R>;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
      removeListener(callback: (...args: any[]) => void): void;
    };

    function getURL(path: string): string;
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const local: StorageArea;
    const sync: StorageArea;

    interface StorageChange {
      oldValue?: any;
      newValue?: any;
    }

    const onChanged: {
      addListener(
        callback: (
          changes: Record<string, StorageChange>,
          areaName: "local" | "sync" | "managed" | "session"
        ) => void
      ): void;
      removeListener(callback: (...args: any[]) => void): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
      active?: boolean;
    }

    function query(queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
      url?: string | string[];
    }): Promise<Tab[]>;

    function sendMessage<M = any, R = any>(
      tabId: number,
      message: M
    ): Promise<R>;
  }

  namespace commands {
    const onCommand: {
      addListener(callback: (command: string) => void): void;
      removeListener(callback: (...args: any[]) => void): void;
    };
  }

  namespace scripting {
    function executeScript(injection: {
      target: { tabId: number; allFrames?: boolean };
      files?: string[];
    }): Promise<any[]>;
    function insertCSS(injection: {
      target: { tabId: number; allFrames?: boolean };
      files?: string[];
    }): Promise<void>;
  }
}
